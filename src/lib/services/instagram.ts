import { randomUUID } from "node:crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { readDatabase } from "@/lib/db/read";
import {
  instagramConnection,
  instagramMedia,
  siteSetting,
} from "@/lib/db/schema";
import {
  INSTAGRAM_ENABLED_KEY,
  INSTAGRAM_MAX_POSTS,
  INSTAGRAM_SYNC_MINUTES,
  INSTAGRAM_PROBLEMS,
  isInstagramPermalink,
  type InstagramAdminState,
  type InstagramFeed,
  type InstagramPost,
  type InstagramProblem,
} from "@/lib/config/instagram";
import {
  exchangeInstagramCode,
  instagramConfigured,
  InstagramError,
  readInstagramMedia,
  readInstagramProfile,
  refreshInstagramToken,
} from "@/lib/integrations/instagram";
import {
  decryptInstagramToken,
  encryptInstagramToken,
} from "@/lib/helpers/instagram-vault";

const publicColumns = {
  id: instagramMedia.id,
  permalink: instagramMedia.permalink,
  caption: instagramMedia.caption,
  kind: instagramMedia.kind,
  publishedAt: instagramMedia.publishedAt,
  hidden: instagramMedia.hidden,
};
function posts(
  rows: {
    id: string;
    permalink: string;
    caption: string;
    kind: string;
    publishedAt: Date;
    hidden: boolean;
  }[],
): InstagramPost[] {
  return rows
    .filter(
      (r) =>
        isInstagramPermalink(r.permalink) &&
        ["IMAGE", "VIDEO", "CAROUSEL_ALBUM"].includes(r.kind),
    )
    .map((r) => ({
      ...r,
      kind: r.kind as InstagramPost["kind"],
      publishedAt: r.publishedAt.toISOString(),
    }));
}
/** One bounded read of public metadata. The token and source image URLs never enter public props. */
export async function loadInstagramFeed(): Promise<
  InstagramFeed & { validUntil: string | null }
> {
  return readDatabase(async (tx) => {
    const [setting] = await tx
      .select({ value: siteSetting.value })
      .from(siteSetting)
      .where(eq(siteSetting.key, INSTAGRAM_ENABLED_KEY));
    const enabled = setting?.value !== false;
    if (!enabled) return { enabled: false, posts: [], validUntil: null };
    const [connection] = await tx
      .select({
        expiresAt: instagramConnection.expiresAt,
        lastSyncedAt: instagramConnection.lastSyncedAt,
        problem: instagramConnection.lastProblem,
      })
      .from(instagramConnection);
    const now = Date.now();
    if (
      !connection ||
      connection.problem === "authorization" ||
      connection.expiresAt.getTime() <= now ||
      !connection.lastSyncedAt ||
      connection.lastSyncedAt.getTime() < now - 86400_000
    )
      return { enabled: true, posts: [], validUntil: null };
    const rows = await tx
      .select(publicColumns)
      .from(instagramMedia)
      .where(
        and(
          eq(instagramMedia.available, true),
          eq(instagramMedia.hidden, false),
        ),
      )
      .orderBy(desc(instagramMedia.publishedAt), desc(instagramMedia.id))
      .limit(INSTAGRAM_MAX_POSTS);
    return {
      enabled: true,
      posts: posts(rows),
      validUntil: new Date(
        Math.min(
          connection.expiresAt.getTime(),
          connection.lastSyncedAt.getTime() + 86400_000,
        ),
      ).toISOString(),
    };
  });
}
export async function getInstagramAdminState(): Promise<InstagramAdminState> {
  return readDatabase(async (tx) => {
    const [setting] = await tx
      .select({ value: siteSetting.value })
      .from(siteSetting)
      .where(eq(siteSetting.key, INSTAGRAM_ENABLED_KEY));
    const [connection] = await tx
      .select({
        username: instagramConnection.username,
        expiresAt: instagramConnection.expiresAt,
        lastSyncedAt: instagramConnection.lastSyncedAt,
        lastProblem: instagramConnection.lastProblem,
      })
      .from(instagramConnection);
    const rows = await tx
      .select(publicColumns)
      .from(instagramMedia)
      .where(eq(instagramMedia.available, true))
      .orderBy(desc(instagramMedia.publishedAt), desc(instagramMedia.id));
    const problem =
      connection?.expiresAt && connection.expiresAt <= new Date()
        ? "authorization"
        : (INSTAGRAM_PROBLEMS.find((p) => p === connection?.lastProblem) ??
          null);
    return {
      configured: instagramConfigured(),
      connected: Boolean(connection),
      enabled: setting?.value !== false,
      username: connection?.username ?? null,
      expiresAt: connection?.expiresAt.toISOString() ?? null,
      lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
      problem,
      posts: posts(rows),
    };
  });
}
export async function connectInstagram(
  code: string,
  redirectUri: string,
  adminId: string,
) {
  const token = await exchangeInstagramCode(code, redirectUri);
  const profile = await readInstagramProfile(token.token);
  const now = new Date();
  await db.transaction(async (tx) => {
    // Serialise connect/disconnect with committing sync results, independently of booking locks.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('instagram:connection'))`,
    );
    const [before] = await tx
      .select({ accountId: instagramConnection.accountId })
      .from(instagramConnection);
    if (before && before.accountId !== profile.accountId)
      await tx.delete(instagramConnection);
    const value = {
      id: "main",
      ...profile,
      oauthUserId: token.oauthUserId,
      tokenCiphertext: encryptInstagramToken(token.token, profile.accountId),
      expiresAt: new Date(now.getTime() + token.expiresIn * 1000),
      tokenRefreshedAt: now,
      connectedAt: now,
      connectedByAdminId: adminId,
      lastProblem: null,
      leaseId: null,
      leaseUntil: null,
    };
    await tx
      .insert(instagramConnection)
      .values(value)
      .onConflictDoUpdate({ target: instagramConnection.id, set: value });
  });
}
export async function disconnectInstagram(request?: {
  userId: string;
  issuedAt: Date;
}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext('instagram:connection'))`,
    );
    const [connection] = await tx
      .select({
        oauthUserId: instagramConnection.oauthUserId,
        accountId: instagramConnection.accountId,
        connectedAt: instagramConnection.connectedAt,
      })
      .from(instagramConnection)
      .for("update");
    if (!connection) return;
    // A delayed revocation of an old grant must not remove a later re-connection.
    if (
      request &&
      (![connection.oauthUserId, connection.accountId].includes(
        request.userId,
      ) ||
        connection.connectedAt.getTime() > request.issuedAt.getTime() + 1000)
    )
      return;
    await tx.delete(instagramConnection); // FK cascade removes only Instagram media.
  });
}
export async function setInstagramHidden(id: string, hidden: boolean) {
  const updated = await db
    .update(instagramMedia)
    .set({ hidden })
    .where(and(eq(instagramMedia.id, id), eq(instagramMedia.available, true)))
    .returning({ id: instagramMedia.id });
  if (!updated.length) throw new InstagramError("provider");
}

/** Fenced lease: no DB connection is held while waiting for Meta, and late replies cannot resurrect disconnected data. */
export async function syncInstagram({
  force = false,
}: { force?: boolean } = {}) {
  if (!instagramConfigured())
    return { synced: false, problem: "not_configured" as InstagramProblem };
  const now = new Date(),
    leaseId = randomUUID();
  const [connection] = await db
    .update(instagramConnection)
    .set({
      leaseId,
      leaseUntil: new Date(now.getTime() + 90_000),
      lastAttemptAt: now,
    })
    .where(
      and(
        eq(instagramConnection.id, "main"),
        sql`(${instagramConnection.leaseUntil} is null or ${instagramConnection.leaseUntil} < ${now})`,
        sql`(${instagramConnection.lastAttemptAt} is null or ${instagramConnection.lastAttemptAt} < ${new Date(now.getTime() - (force ? 10_000 : INSTAGRAM_SYNC_MINUTES * 60_000))})`,
      ),
    )
    .returning();
  if (!connection)
    return { synced: false, problem: "busy" as InstagramProblem };
  try {
    if (connection.expiresAt <= now) throw new InstagramError("authorization");
    let token = decryptInstagramToken(
      connection.tokenCiphertext,
      connection.accountId,
    );
    if (
      connection.expiresAt.getTime() < now.getTime() + 14 * 86400_000 &&
      connection.tokenRefreshedAt.getTime() < now.getTime() - 86400_000
    ) {
      const refreshed = await refreshInstagramToken(token);
      token = refreshed.token;
      const retained = await db
        .update(instagramConnection)
        .set({
          tokenCiphertext: encryptInstagramToken(token, connection.accountId),
          tokenRefreshedAt: now,
          expiresAt: new Date(now.getTime() + refreshed.expiresIn * 1000),
        })
        .where(eq(instagramConnection.leaseId, leaseId))
        .returning({ id: instagramConnection.id });
      if (!retained.length)
        return { synced: false, problem: "busy" as InstagramProblem };
    }
    const media = await readInstagramMedia(connection.accountId, token);
    const committed = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('instagram:connection'))`,
      );
      const [current] = await tx
        .select({ id: instagramConnection.id })
        .from(instagramConnection)
        .where(eq(instagramConnection.leaseId, leaseId))
        .for("update");
      if (!current) return false;
      await tx.update(instagramMedia).set({ available: false });
      for (const m of media)
        await tx
          .insert(instagramMedia)
          .values({ ...m, connectionId: "main", available: true })
          .onConflictDoUpdate({
            target: instagramMedia.id,
            set: { ...m, available: true },
          });
      // Retain only hidden IDs as preferences. Deleted/old post content is discarded.
      await tx
        .delete(instagramMedia)
        .where(
          and(
            eq(instagramMedia.available, false),
            eq(instagramMedia.hidden, false),
          ),
        );
      await tx
        .update(instagramMedia)
        .set({ caption: "", imageUrl: "", permalink: "" })
        .where(eq(instagramMedia.available, false));
      await tx
        .update(instagramConnection)
        .set({
          lastSyncedAt: now,
          lastProblem: null,
          leaseId: null,
          leaseUntil: null,
        })
        .where(eq(instagramConnection.leaseId, leaseId));
      return true;
    });
    return {
      synced: committed,
      problem: committed ? null : ("busy" as InstagramProblem),
    };
  } catch (error) {
    const problem =
      error instanceof InstagramError ? error.problem : "provider";
    await db
      .update(instagramConnection)
      .set({ lastProblem: problem, leaseId: null, leaseUntil: null })
      .where(eq(instagramConnection.leaseId, leaseId));
    return { synced: false, problem };
  }
}

/** Only an available, authorised, non-hidden post can be fetched by the image endpoint. */
export async function instagramImageSource(id: string) {
  if (!/^\d{1,30}$/.test(id)) return null;
  return readDatabase(async (tx) => {
    const [row] = await tx
      .select({ url: instagramMedia.imageUrl })
      .from(instagramMedia)
      .innerJoin(
        instagramConnection,
        eq(instagramConnection.id, instagramMedia.connectionId),
      )
      .where(
        and(
          eq(instagramMedia.id, id),
          eq(instagramMedia.hidden, false),
          eq(instagramMedia.available, true),
          sql`${instagramConnection.expiresAt} > now()`,
          sql`${instagramConnection.lastSyncedAt} > now() - interval '24 hours'`,
          sql`(${instagramConnection.lastProblem} is null or ${instagramConnection.lastProblem} <> 'authorization')`,
        ),
      );
    return row?.url ?? null;
  });
}
