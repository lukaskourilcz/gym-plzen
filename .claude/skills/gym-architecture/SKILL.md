---
name: gym-architecture
description: >-
  Architecture, conventions, and integration wiring for the gym-plzen booking &
  CMS system (Next.js + Drizzle + Supabase Auth + Stripe/Nuki/WhatsApp/Resend).
  Use when implementing features, wiring integrations, editing the schema, or
  adding admin modules in this repo.
---

# gym-plzen architecture

A single-occupancy gym booking system: visitors book one-at-a-time training
slots, pay one-time entry (290 Kč, every 10th free for members: no
subscriptions), and receive a time-limited Nuki keypad code over
email/WhatsApp. An account is optional. An admin CMS ("redakční systém")
manages content, reservations, members, pricing, and monitors reliability.

## Layered architecture: respect the boundaries

```
app/ (routes, server actions)  ─calls→  lib/services/  ─calls→  lib/db + lib/integrations
                                              │
                                    lib/helpers (reused everywhere)
```

- **Routes & server actions** (`src/app/**`): HTTP/UI only. Actions validate
  with Zod, authorize, call a service, revalidate. No business logic, no direct
  DB access.
- **Services** (`src/lib/services/*`): all business logic and the ONLY layer
  that touches `db` and integrations. Namespaced barrel: `import { reservations,
cms, loyalty } from "@/lib/services"`.
- **Integrations** (`src/lib/integrations/*`): thin adapters over Stripe, Nuki,
  WhatsApp, Resend, GoSMS, Supabase. Lazy init, `is*Configured()`, typed results.
- **Helpers** (`src/lib/helpers/*`): reusable, cross-cutting: `result`, `action`
  (`ActionError`, `defineAction`), `http` (`httpRequest` with retry/backoff),
  `crypto`, `datetime`, `format`, `phone`, `logger`, `cron`. **Reuse these;
  extract a new one before duplicating logic.**

## Forms (React Hook Form + Zod)

Every form: admin and login: is built on **React Hook Form + Zod**:

- Zod schemas in `src/lib/validations/*` are **transform-free** and used on BOTH
  sides (client `zodResolver` and server re-validation). Type conversions
  (date-string → `Date`, "HH:mm" → minutes, "" → `null`) happen in the action.
- Client: `useActionForm({ schema, action, defaultValues })`
  (`@/components/admin/use-action-form`) wires RHF + resolver, calls the action,
  and maps server field errors back onto the form. Build fields with `Field`,
  `FormFeedback`, `SubmitButton` (`@/components/admin/form-controls`).
- Server: actions are `defineAction({ schema, authorize: assertAdmin, handler })`
  returning a `Result`, exported wrapped in a plain `async function`.
- Reference: `src/app/admin/reservations/{actions.ts,reservation-form.tsx}`.
- **DB** (`src/lib/db`): Drizzle schema (`schema/*`), client (`index.ts`),
  derived types (`types.ts`).
- **Config** (`src/lib/config/*`): tunable constants (e.g. `pricing.ts`).

## Key domain rules

- **No double-booking**: enforced in `services/availability.ts` (overlap query)
  AND a DB exclusion constraint (`drizzle/0001_reservation_no_overlap.sql`).
- **Reliability pipeline**: every confirmed reservation runs
  payment → code_created → code_delivered (`services/pipeline.ts`,
  `services/fulfillment.ts`). Failures retry with backoff; exhausted steps call
  `services/alerts.ts` which fans out to the WhatsApp group.
- **Multi-channel codes**: `services/notifications.ts` sends the access code over
  every enabled channel at once and records a `messageDelivery` per channel.
- **Loyalty**: `services/loyalty.ts`: every 10th entry free; `deriveLoyaltyStatus`
  is a pure, testable function. Widget: `components/loyalty-widget.tsx`.
- **CMS**: content is addressable blocks keyed by `(key, locale)` in
  `services/cms.ts`; `getText("home.hero.title")` on the site, `upsertBlock` in
  the admin.
- **Booking availability**: `services/slots.ts` resolves configured weekday
  duration and returns `live`, non-production `preview`, or `unavailable`.
  Production never falls back to fictional slots.
- **Guest booking**: `/rezervace` → `/rezervace/udaje?start=<ISO>` → Stripe.
  `booking.startBooking` takes a nullable `userId`; a guest reservation has
  `userId = null` and is identified by its contact snapshot. Ownership checks
  (Stripe webhook, `getBookingConfirmation`) compare both sides as nullable, so
  `null === null` is a valid match and a member's booking still cannot be
  claimed by anyone else. Loyalty needs an account and stays members-only.
- **Consents**: both checkboxes (house rules, terms) are part of the
  reservation, not the account, so every visitor ticks them per booking. Stored
  as `rules_accepted_at` / `terms_accepted_at` timestamps, set from server time.
- **Public Realtime**: subscribe only to the PII-free `availability_signal`
  table created by migration `0003`. Never publish `reservation` rows to public
  clients.

## Auth

**Supabase Auth**. Users live in `auth.users` (Supabase-managed); each has a
`public.profiles` row (id = auth uid, mirrors email/name, holds `role`). A
trigger (`on_auth_user_created`, migration `0002`) creates the profile on
sign-up; `ensureProfileForUser` is the app-side fallback.

- Clients: `src/lib/supabase/{server,client}.ts` (SSR + browser), `middleware.ts`
  refreshes the session, `app/auth/callback` exchanges the OAuth code.
- Guards: `src/lib/auth/guards.ts`: `getSessionUser`/`getSession`, `requireUser`,
  `requireAdmin` (Server Components), `assertAdmin` (actions). Admin =
  `role === "admin"`; set the first one with `npm run set-admin -- you@example.com`.
- OAuth providers (`google`, `apple`, `azure`) must be configured in the
  Supabase dashboard and explicitly enabled in the public UI through the
  comma-separated `NEXT_PUBLIC_OAUTH_PROVIDERS`. Unconfigured providers stay
  hidden and OAuth failures produce Czech feedback.
- Demo authentication is a local presentation aid only. `demo-policy.ts`
  disables it whenever `NODE_ENV` or `VERCEL_ENV` indicates production.
- Demo admin data is deterministic, local and Czech in `lib/demo/dummy.ts`.
  Never reintroduce a runtime dependency on a public fixture API.

## Adding things

- New admin section → `admin-module-builder` subagent or `/new-admin-module`.
- New integration → `integration-builder` subagent or `/add-integration`.
- Schema change → edit `schema/*`, export in `schema/index.ts`, type in
  `db/types.ts`, then `/db-migrate`.

## UI and design-system governance

`docs/DESIGN_SYSTEM.md` is the canonical design specification and
`/admin/design-system` is its protected rendered reference. Before non-trivial
UI work, read the document and `.claude/rules/design-system.md`. Reuse semantic
tokens and shared components, keep controls minimally rounded, preserve 44px
targets, and verify mobile, keyboard, focus, contrast, zoom, and reduced motion.
Update the documentation and rendered kit together when adding a justified
reusable pattern.

## Always before finishing

Use Node.js 22. Run `npm run format:check`, `npm run lint`, `npm run typecheck`,
`npm test` and, for anything non-trivial, `npm run build`. All
user-facing copy is Czech. Secrets are added to `env.ts` + `.env.example` +
`NEEDED.md` together. Manual/operator setup goes in `NEEDED.md`.
