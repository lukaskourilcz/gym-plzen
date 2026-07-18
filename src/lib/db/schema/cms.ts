import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { profiles } from "./members";
import { cmsBlockType } from "./enums";

/**
 * The "redakční systém" (CMS). Content is modelled as addressable blocks so the
 * admin can edit any text / image / file on the site without a deploy.
 *
 * A block is identified by a stable `key` (e.g. "home.hero.title"). The public
 * site reads blocks by key; the admin edits them by key. `locale` allows the
 * same key to carry Czech/English/… variants.
 */
export const contentBlock = pgTable(
  "content_block",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: text("key").notNull(),
    locale: text("locale").notNull().default("cs"),
    type: cmsBlockType("type").notNull().default("text"),

    // Only one of these is used depending on `type`. Keeping them as distinct
    // columns (rather than one opaque blob) keeps queries and validation clean.
    valueText: text("value_text"),
    valueJson: jsonb("value_json"),
    mediaId: uuid("media_id").references(() => mediaAsset.id, {
      onDelete: "set null",
    }),

    // Human-friendly label + group shown in the admin editor.
    label: text("label"),
    groupName: text("group_name"),
    sortOrder: integer("sort_order").default(0).notNull(),

    updatedByAdminId: uuid("updated_by_admin_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    // A key is unique within a locale (also the upsert conflict target).
    uniqueIndex("content_block_key_locale_idx").on(t.key, t.locale),
  ],
);

/**
 * A file uploaded through the CMS (image or document), stored in Supabase
 * Storage. We keep metadata here and the binary in the bucket.
 */
export const mediaAsset = pgTable("media_asset", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Path within the storage bucket.
  storagePath: text("storage_path").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  width: integer("width"),
  height: integer("height"),
  alt: text("alt"), // accessibility / SEO
  uploadedByAdminId: uuid("uploaded_by_admin_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * A managed page (rules, gallery, contact, …). The public route reads the page
 * by `slug`; the admin toggles visibility and edits SEO metadata.
 */
export const page = pgTable("page", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  // SEO
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  isPublished: boolean("is_published").default(false).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Global, single-row-ish key/value settings (site name, contact, socials). */
export const siteSetting = pgTable("site_setting", {
  key: text("key").primaryKey(),
  value: jsonb("value"),
  updatedByAdminId: uuid("updated_by_admin_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
