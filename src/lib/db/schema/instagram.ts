import { sql } from "drizzle-orm";
import { boolean, check, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/** Private, server-only integration records; never exposed through the browser's Supabase API. */
export const instagramConnection = pgTable(
  "instagram_connection",
  {
    id: text("id").primaryKey().default("main"),
    accountId: text("account_id").notNull(),
    oauthUserId: text("oauth_user_id").notNull(),
    username: text("username").notNull(),
    tokenCiphertext: text("token_ciphertext").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    tokenRefreshedAt: timestamp("token_refreshed_at", {
      withTimezone: true,
    }).notNull(),
    connectedAt: timestamp("connected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    connectedByAdminId: text("connected_by_admin_id"),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
    lastProblem: text("last_problem"),
    leaseId: text("lease_id"),
    leaseUntil: timestamp("lease_until", { withTimezone: true }),
  },
  (t) => [check("instagram_connection_singleton", sql`${t.id} = 'main'`)],
);

export const instagramMedia = pgTable(
  "instagram_media",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id")
      .notNull()
      .references(() => instagramConnection.id, { onDelete: "cascade" }),
    permalink: text("permalink").notNull(),
    caption: text("caption").notNull().default(""),
    kind: text("kind").notNull(),
    imageUrl: text("image_url").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    hidden: boolean("hidden").notNull().default(false),
  },
  (t) => [
    check(
      "instagram_media_kind",
      sql`${t.kind} in ('IMAGE', 'VIDEO', 'CAROUSEL_ALBUM')`,
    ),
  ],
);
