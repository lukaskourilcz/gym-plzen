---
description: Generate and apply a Drizzle migration for schema changes
argument-hint: <short name for the change, e.g. "add_gallery">
---

Handle the database migration workflow for change: **$ARGUMENTS**

Steps:
1. Confirm the schema edits under `src/lib/db/schema/` are complete and that the
   table is exported from `schema/index.ts` and typed in `db/types.ts`.
2. Generate the migration:
   `npx drizzle-kit generate --name $ARGUMENTS`
3. Read the generated SQL in `drizzle/` and sanity-check it (no accidental drops,
   correct nullability, indexes present). If a hand-written constraint is needed
   (e.g. an exclusion constraint), generate a custom migration with
   `npx drizzle-kit generate --custom --name $ARGUMENTS` and fill it in — see
   `drizzle/0001_reservation_no_overlap.sql` as the reference.
4. Apply it against the database: `npm run db:migrate`
   (requires `DIRECT_URL` / `DATABASE_URL` in `.env.local`).
5. Run `npx tsc --noEmit` to confirm the app still typechecks.

Report the migration filename and whether it applied cleanly.
