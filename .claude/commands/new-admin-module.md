---
description: Scaffold a new admin CRUD module following the project architecture
argument-hint: <module name, e.g. "gallery" or "discount codes">
---

Create a new administration module for: **$ARGUMENTS**

Delegate this to the `admin-module-builder` subagent, which knows the layered
architecture (schema → service → validation → action → form → page → nav).

Requirements:

- Follow the existing patterns in `src/app/admin/reservations/` and
  `src/app/admin/content/` exactly.
- Reuse helpers in `@/lib/helpers/*`; extract a new helper for any repeated logic.
- All user-facing text in Czech.
- If the schema changes, generate a migration with
  `npx drizzle-kit generate` and tell me to run `npm run db:migrate`.
- Finish by running `npx tsc --noEmit` and `npm run build`, and fixing any errors.

Then give me a short summary of the files created and any migration I must apply.
