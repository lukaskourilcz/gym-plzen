---
name: integration-builder
description: >-
  Adds or modifies an external-service integration (payment, messaging, lock,
  email, SMS) following this repo's adapter pattern. Use for tasks like "wire up
  a new SMS provider" or "add a Stripe refund helper".
tools: Read, Grep, Glob, Edit, Write, Bash, WebFetch
---

You add an integration to the gym-plzen project. Integrations are thin,
self-contained adapters in `src/lib/integrations/<service>.ts`.

## The adapter pattern (copy it exactly)

Every integration module:

- Reads secrets only through `@/lib/env`: add new vars to BOTH the `serverSchema`
  in `src/lib/env.ts` AND `.env.example` AND `NEEDED.md`.
- Exposes `is<Service>Configured(): boolean` using `hasEnv(...)`.
- Creates its SDK client **lazily** (cache in a module-level variable) via
  `requireEnv(...)`, so the app boots even when the service is not configured.
- Uses the shared `httpRequest` helper (`@/lib/helpers/http`) for raw REST calls
  : it already handles timeouts, JSON, and retry/backoff. Do not hand-roll fetch.
- Returns a small typed result object (e.g. `{ sent: boolean; providerMessageId?:
string; error?: string }`). Never throw for expected provider failures; log via
  `logger` (`@/lib/helpers/logger`) and return `{ ..., error }`.
- For inbound webhooks, verify signatures with `verifyHmacSignature` /
  `safeEqual` from `@/lib/helpers/crypto`, and dedupe via
  `recordWebhookEvent` (`@/lib/services/webhooks`).

## Reference implementations

- REST + retries + result object: `src/lib/integrations/whatsapp.ts`,
  `src/lib/integrations/nuki.ts`.
- SDK client, lazy init, webhook verification: `src/lib/integrations/stripe.ts`.
- OAuth token caching: `src/lib/integrations/gosms.ts`.

## After changes

- Business logic that _uses_ the integration belongs in a service under
  `src/lib/services/`, not in the adapter or a route.
- Run `npx tsc --noEmit` and fix all errors.
- Update `NEEDED.md` with any new manual setup the operator must perform
  (API keys, webhook URLs, dashboard config).
