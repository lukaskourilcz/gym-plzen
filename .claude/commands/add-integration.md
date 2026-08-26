---
description: Add or modify an external-service integration (adapter pattern)
argument-hint: <service name and what it should do>
---

Add / modify the integration described: **$ARGUMENTS**

Delegate to the `integration-builder` subagent. It must follow the adapter
pattern used by `src/lib/integrations/{stripe,whatsapp,nuki,gosms,resend}.ts`:

- New secrets go into `src/lib/env.ts` (serverSchema), `.env.example`, and
  `NEEDED.md`.
- Lazy client init, a private configuration check where needed, typed result
  objects, and no throwing for expected provider failures.
- Use `httpRequest` for REST and `logger` for errors.
- Business logic that uses the integration goes in a `src/lib/services/*` module,
  not the adapter.

Finish with `npx tsc --noEmit`, then summarise what I need to configure manually.
