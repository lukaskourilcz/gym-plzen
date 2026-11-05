import { readBodyBytes } from "@/lib/helpers/limited-body";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { env } from "@/lib/env";
import {
  INSTAGRAM_USERNAME,
  isInstagramImageUrl,
  isInstagramPermalink,
  type InstagramProblem,
  instagramProfileSchema,
} from "@/lib/config/instagram";

export class InstagramError extends Error {
  constructor(public readonly problem: InstagramProblem) {
    super(`Instagram: ${problem}`);
  }
}
const UNIFIED_GRAPH_VERSION = "v26.0";
const NAVI_META_BUSINESS_ID = "1615625080049734";
const NAVI_META_INSTAGRAM_ID = "17841427246422536";
export const INSTAGRAM_UNLIMITED_EXPIRY = Date.UTC(9999, 11, 31);
// Plain Node uses the SDK's CommonJS entry point.
const { suppressTracing } =
  typeof Sentry.suppressTracing === "function"
    ? Sentry
    : (Sentry as unknown as { default: typeof Sentry }).default;
export function instagramConfigured() {
  return Boolean(
    env.INSTAGRAM_APP_ID &&
    env.INSTAGRAM_APP_SECRET &&
    env.INSTAGRAM_TOKEN_ENCRYPTION_KEY,
  );
}
export type InstagramProvider = "instagram" | "unified" | "facebook-user";
/** Facebook user login wins over a Unified Login configuration; Instagram Login is the legacy default. */
export function instagramLoginMode(): InstagramProvider {
  if (env.INSTAGRAM_FACEBOOK_USER_LOGIN === "true") return "facebook-user";
  if (env.INSTAGRAM_UNIFIED_CONFIG_ID) return "unified";
  return "instagram";
}
function endpoint(
  host: "graph" | "auth" | "login" | "facebook-graph" | "facebook-login",
  path: string,
) {
  const test = env.INSTAGRAM_TEST_BASE_URL;
  if (test) {
    const u = new URL(test);
    if (
      !(
        process.env.NODE_ENV === "test" || process.env.E2E_LOCAL_AUTH === "true"
      ) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
    )
      throw new InstagramError("not_configured");
    return new URL(`/${host}${path}`, u);
  }
  return new URL(
    path,
    {
      graph: "https://graph.instagram.com",
      auth: "https://api.instagram.com",
      login: "https://www.instagram.com",
      "facebook-graph": "https://graph.facebook.com",
      "facebook-login": "https://www.facebook.com",
    }[host],
  );
}
export function instagramAuthorizationUrl(redirectUri: string, state: string) {
  if (!instagramConfigured()) throw new InstagramError("not_configured");
  const mode = instagramLoginMode();
  if (mode === "facebook-user") {
    const url = endpoint("facebook-login", "/dialog/oauth");
    url.search = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "instagram_basic",
      state,
    }).toString();
    return url.toString();
  }
  if (mode === "unified") {
    const url = endpoint("facebook-login", "/dialog/oauth");
    url.search = new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID!,
      config_id: env.INSTAGRAM_UNIFIED_CONFIG_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      override_default_response_type: "true",
      state,
      prompt: "login",
    }).toString();
    return url.toString();
  }
  const url = endpoint("login", "/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_business_basic",
    state,
    enable_fb_login: "0",
    force_authentication: "1",
  }).toString();
  return url.toString();
}
export async function readLimitedBody(
  response: Pick<Response, "body" | "headers">,
  limit: number,
  problem: InstagramProblem = "provider",
) {
  try {
    return await readBodyBytes(response, limit);
  } catch {
    throw new InstagramError(problem);
  }
}
/** Meta sometimes returns 64-bit IDs as JSON numbers. Node 22 supplies their exact source. */
export function parseInstagramJson(value: string): unknown {
  return JSON.parse(
    value,
    (key: string, item: unknown, context?: { source?: string }) => {
      if (
        ["id", "user_id", "app_id", "client_business_id"].includes(key) &&
        typeof item === "number"
      ) {
        if (context?.source && /^\d{1,30}$/.test(context.source))
          return context.source;
        if (Number.isSafeInteger(item)) return String(item);
        throw new InstagramError("provider");
      }
      return item;
    },
  );
}
async function jsonRequest(url: URL, init: RequestInit = {}) {
  try {
    // Some Meta endpoints require credentials in the query string. Keep these
    // requests out of automatic HTTP traces as well as application logs.
    const response = await suppressTracing(() =>
      fetch(url, {
        ...init,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      }),
    );
    const data = parseInstagramJson(
      (await readLimitedBody(response, 512_000)).toString("utf8"),
    );
    const errorCode = (data as { error?: { code?: number } })?.error?.code;
    if (response.status === 401 || errorCode === 190 || errorCode === 102)
      throw new InstagramError("authorization");
    if (!response.ok) throw new InstagramError("provider");
    return data;
  } catch (error) {
    if (error instanceof InstagramError) throw error;
    // Provider URLs can contain credentials. Never include the URL or raw error in logs/results.
    throw new InstagramError("provider");
  }
}
const tokenSchema = z.object({
  access_token: z.string().min(8).max(8192),
  expires_in: z
    .number()
    .positive()
    .max(366 * 86400),
});
function parseToken(raw: unknown) {
  const result = tokenSchema.safeParse(raw);
  if (!result.success) throw new InstagramError("authorization");
  return { token: result.data.access_token, expiresIn: result.data.expires_in };
}
async function exchangeInstagramCode(code: string, redirectUri: string) {
  if (!instagramConfigured()) throw new InstagramError("not_configured");
  const raw = await jsonRequest(endpoint("auth", "/oauth/access_token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID!,
      client_secret: env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const single = z.object({
    access_token: z.string().min(8).max(8192),
    user_id: z.union([z.string(), z.number()]).transform(String),
  });
  const parsed = z
    .union([
      single,
      z.object({ data: z.array(single).min(1) }).transform((v) => v.data[0]!),
    ])
    .safeParse(raw);
  if (!parsed.success) throw new InstagramError("authorization");
  const url = endpoint("graph", "/access_token");
  url.search = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: env.INSTAGRAM_APP_SECRET!,
    access_token: parsed.data.access_token,
  }).toString();
  return {
    ...parseToken(await jsonRequest(url)),
    oauthUserId: parsed.data.user_id,
  };
}
export async function refreshInstagramToken(token: string) {
  const url = endpoint("graph", "/refresh_access_token");
  url.search = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: token,
  }).toString();
  return parseToken(await jsonRequest(url));
}
function graph(path: string, token: string, fields: string, unified = false) {
  const url = unified
    ? endpoint("facebook-graph", `/${UNIFIED_GRAPH_VERSION}${path}`)
    : endpoint("graph", `/${env.INSTAGRAM_GRAPH_VERSION}${path}`);
  url.search = new URLSearchParams({ fields }).toString();
  return { url, init: { headers: { Authorization: `Bearer ${token}` } } };
}
const metaId = z.string().regex(/^\d{1,30}$/);
const tokenValue = z.string().min(8).max(8192);
const unifiedAccountSchema = z.object({ id: metaId, username: z.string() });
const debugTokenSchema = z.object({
  data: z.object({
    app_id: metaId,
    type: z.string().optional(),
    is_valid: z.literal(true),
    scopes: z.array(z.string()).max(100),
    granular_scopes: z
      .array(
        z.object({
          scope: z.string(),
          target_ids: z.array(metaId).max(1000).optional(),
        }),
      )
      .max(100)
      .optional(),
    expires_at: z.number().int().nonnegative(),
    data_access_expires_at: z.number().int().nonnegative().optional(),
  }),
});
/** Meta's default template includes messaging. Reject permissions beyond reading the feed. */
async function debugMetaToken(token: string) {
  const debugUrl = endpoint(
    "facebook-graph",
    `/${UNIFIED_GRAPH_VERSION}/debug_token`,
  );
  debugUrl.searchParams.set("input_token", token);
  const debug = debugTokenSchema.safeParse(
    await jsonRequest(debugUrl, {
      headers: {
        Authorization: `Bearer ${env.INSTAGRAM_APP_ID!}|${env.INSTAGRAM_APP_SECRET!}`,
      },
    }),
  );
  if (!debug.success || debug.data.data.app_id !== env.INSTAGRAM_APP_ID)
    throw new InstagramError("authorization");
  const { scopes, expires_at, data_access_expires_at } = debug.data.data;
  if (
    !scopes.includes("instagram_basic") ||
    scopes.some(
      (scope) => !["instagram_basic", "public_profile"].includes(scope),
    )
  )
    throw new InstagramError("permissions");
  const expiry = Math.min(
    expires_at ? expires_at * 1000 : INSTAGRAM_UNLIMITED_EXPIRY,
    data_access_expires_at
      ? data_access_expires_at * 1000
      : INSTAGRAM_UNLIMITED_EXPIRY,
  );
  if (expiry <= Date.now()) throw new InstagramError("authorization");
  return { ...debug.data.data, expiry };
}
async function facebookTokenRequest(params: Record<string, string>) {
  const url = endpoint(
    "facebook-graph",
    `/${UNIFIED_GRAPH_VERSION}/oauth/access_token`,
  );
  url.search = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID!,
    client_secret: env.INSTAGRAM_APP_SECRET!,
    ...params,
  }).toString();
  const parsed = z
    .object({
      access_token: tokenValue,
      expires_in: z
        .number()
        .positive()
        .max(366 * 86400)
        .optional(),
    })
    .safeParse(await jsonRequest(url));
  if (!parsed.success) throw new InstagramError("authorization");
  return parsed.data;
}
/**
 * A user token is bound to the NAVI account through its granular scope, then
 * the account is read directly. Any other grant is refused.
 */
async function verifyFacebookUserToken(token: string) {
  const debug = await debugMetaToken(token);
  if (debug.type && debug.type !== "USER")
    throw new InstagramError("authorization");
  const targets = debug.granular_scopes?.find(
    (entry) => entry.scope === "instagram_basic",
  )?.target_ids;
  if (targets && !targets.includes(NAVI_META_INSTAGRAM_ID))
    throw new InstagramError("wrong_account");
  const direct = graph(
    `/${NAVI_META_INSTAGRAM_ID}`,
    token,
    "id,username",
    true,
  );
  const profile = unifiedAccountSchema.safeParse(
    await jsonRequest(direct.url, direct.init),
  );
  if (
    !profile.success ||
    profile.data.id !== NAVI_META_INSTAGRAM_ID ||
    profile.data.username.toLowerCase() !== INSTAGRAM_USERNAME
  )
    throw new InstagramError("wrong_account");
  const principal = graph("/me", token, "id", true);
  const owner = z
    .object({ id: metaId })
    .safeParse(await jsonRequest(principal.url, principal.init));
  if (!owner.success) throw new InstagramError("authorization");
  return { expiry: debug.expiry, oauthUserId: owner.data.id };
}
/** Facebook Login with a user token: the admin grants instagram_basic for @navi_plzen only. */
async function exchangeFacebookUserCode(code: string, redirectUri: string) {
  if (!instagramConfigured()) throw new InstagramError("not_configured");
  const short = await facebookTokenRequest({ redirect_uri: redirectUri, code });
  const long = await facebookTokenRequest({
    grant_type: "fb_exchange_token",
    fb_exchange_token: short.access_token,
  });
  const token = long.access_token;
  const verified = await verifyFacebookUserToken(token);
  return {
    token,
    provider: "facebook-user" as const,
    configId: null,
    businessId: null,
    oauthUserId: verified.oauthUserId,
    accountId: NAVI_META_INSTAGRAM_ID,
    username: INSTAGRAM_USERNAME,
    expiresAt: new Date(
      Math.min(
        verified.expiry,
        long.expires_in
          ? Date.now() + long.expires_in * 1000
          : INSTAGRAM_UNLIMITED_EXPIRY,
      ),
    ),
  };
}
/** Re-exchanges a still valid long-lived user token and re-verifies the account. */
export async function refreshFacebookUserToken(token: string) {
  const long = await facebookTokenRequest({
    grant_type: "fb_exchange_token",
    fb_exchange_token: token,
  });
  const verified = await verifyFacebookUserToken(long.access_token);
  return {
    token: long.access_token,
    expiresAt: new Date(
      Math.min(
        verified.expiry,
        long.expires_in
          ? Date.now() + long.expires_in * 1000
          : INSTAGRAM_UNLIMITED_EXPIRY,
      ),
    ),
  };
}

async function exchangeUnifiedInstagramCode(code: string, redirectUri: string) {
  const configId = env.INSTAGRAM_UNIFIED_CONFIG_ID;
  if (!configId || !instagramConfigured())
    throw new InstagramError("not_configured");
  const url = endpoint(
    "facebook-graph",
    `/${UNIFIED_GRAPH_VERSION}/oauth/access_token`,
  );
  url.search = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID!,
    client_secret: env.INSTAGRAM_APP_SECRET!,
    redirect_uri: redirectUri,
    code,
  }).toString();
  const exchange = z
    .object({ access_token: tokenValue })
    .safeParse(await jsonRequest(url));
  if (!exchange.success) throw new InstagramError("authorization");
  const token = exchange.data.access_token;
  const { expiry } = await debugMetaToken(token);
  const principal = graph("/me", token, "id,client_business_id", true);
  const accounts = graph(
    "/me/assigned_instagram_accounts",
    token,
    "id,username",
    true,
  );
  accounts.url.searchParams.set("limit", "100");
  const [owner, assigned] = await Promise.all([
    jsonRequest(principal.url, principal.init),
    jsonRequest(accounts.url, accounts.init),
  ]);
  const identity = z
    .object({ id: metaId, client_business_id: metaId })
    .safeParse(owner);
  const profiles = z
    .object({ data: z.array(unifiedAccountSchema).max(100) })
    .safeParse(assigned);
  if (!identity.success || !profiles.success)
    throw new InstagramError("authorization");
  let profile = profiles.data.data.find(
    (account) => account.username.toLowerCase() === INSTAGRAM_USERNAME,
  );
  // Meta can return an empty assignment list even after the owning portfolio
  // shares its account. Let Meta authorize a direct read of that one asset
  // using the same grant. An explicit list of other accounts stays authoritative.
  if (
    !profile &&
    profiles.data.data.length === 0 &&
    identity.data.client_business_id === NAVI_META_BUSINESS_ID
  ) {
    const direct = graph(
      `/${NAVI_META_INSTAGRAM_ID}`,
      token,
      "id,username",
      true,
    );
    const result = unifiedAccountSchema.safeParse(
      await jsonRequest(direct.url, direct.init),
    );
    if (
      result.success &&
      result.data.id === NAVI_META_INSTAGRAM_ID &&
      result.data.username.toLowerCase() === INSTAGRAM_USERNAME
    ) {
      profile = result.data;
    }
  }
  if (!profile) throw new InstagramError("wrong_account");
  return {
    token,
    provider: "unified" as const,
    configId,
    businessId: identity.data.client_business_id,
    oauthUserId: identity.data.id,
    accountId: profile.id,
    username: INSTAGRAM_USERNAME,
    expiresAt: new Date(expiry),
  };
}
const profileSchema = z.object({
  id: z.string().regex(/^\d+$/),
  user_id: z.union([z.string(), z.number()]).transform(String).optional(),
  username: z.string(),
  account_type: z.string().optional(),
});
async function readInstagramProfile(token: string) {
  const { url, init } = graph("/me", token, "id,user_id,username,account_type");
  const result = profileSchema.safeParse(await jsonRequest(url, init));
  if (!result.success) throw new InstagramError("provider");
  const profile = result.data;
  if (
    profile.username.toLowerCase() !== INSTAGRAM_USERNAME ||
    (profile.account_type &&
      !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(
        profile.account_type.toUpperCase(),
      ))
  )
    throw new InstagramError("wrong_account");
  return {
    accountId: profile.user_id ?? profile.id,
    username: profile.username.toLowerCase(),
  };
}
export async function instagramGrant(code: string, redirectUri: string) {
  const mode = instagramLoginMode();
  if (mode === "facebook-user")
    return exchangeFacebookUserCode(code, redirectUri);
  if (mode === "unified")
    return exchangeUnifiedInstagramCode(code, redirectUri);
  const grant = await exchangeInstagramCode(code, redirectUri);
  const profile = await readInstagramProfile(grant.token);
  return {
    ...profile,
    provider: "instagram" as const,
    token: grant.token,
    oauthUserId: grant.oauthUserId,
    expiresAt: new Date(Date.now() + grant.expiresIn * 1000),
    configId: null,
    businessId: null,
  };
}
const mediaSchema = z.object({
  id: z.string().regex(/^\d{1,30}$/),
  media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  permalink: z.string(),
  caption: z.string().max(10_000).optional(),
  timestamp: z.string(),
  children: z
    .object({
      data: z.array(
        z.object({
          media_type: z.string(),
          media_url: z.string().optional(),
          thumbnail_url: z.string().optional(),
        }),
      ),
    })
    .optional(),
});
/** Optional public counters. A missing field or provider failure must not hide the feed. */
export async function readInstagramCounters(
  accountId: string,
  token: string,
  unified = false,
) {
  if (!/^\d{1,30}$/.test(accountId)) return null;
  const { url, init } = graph(
    `/${accountId}`,
    token,
    "media_count,followers_count,follows_count",
    unified,
  );
  try {
    const raw = (await jsonRequest(url, init)) as Record<string, unknown>;
    const parsed = instagramProfileSchema.safeParse({
      postsCount: raw.media_count,
      followersCount: raw.followers_count,
      followingCount: raw.follows_count,
    });
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function readInstagramMedia(
  accountId: string,
  token: string,
  unified = false,
) {
  if (!/^\d{1,30}$/.test(accountId)) throw new InstagramError("authorization");
  const { url, init } = graph(
    `/${accountId}/media`,
    token,
    "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,children{media_type,media_url,thumbnail_url}",
    unified,
  );
  url.searchParams.set("limit", "30");
  const result = z
    .object({ data: z.array(mediaSchema).max(100) })
    .safeParse(await jsonRequest(url, init));
  if (!result.success) throw new InstagramError("provider");
  return result.data.data
    .map((m) => {
      const child = m.children?.data[0];
      const imageUrl =
        m.media_type === "VIDEO"
          ? m.thumbnail_url
          : m.media_type === "CAROUSEL_ALBUM" && child?.media_type === "VIDEO"
            ? child.thumbnail_url
            : (m.media_url ?? child?.media_url);
      const publishedAt = new Date(m.timestamp);
      // A video file must never be used as an image; untrusted hosts never reach the proxy.
      if (
        !imageUrl ||
        !isInstagramImageUrl(imageUrl) ||
        !isInstagramPermalink(m.permalink) ||
        !Number.isFinite(publishedAt.getTime())
      )
        throw new InstagramError("provider");
      return {
        id: m.id,
        kind: m.media_type,
        imageUrl,
        permalink: m.permalink,
        caption: m.caption ?? "",
        publishedAt,
      };
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
