# Project instructions

Read `SESSION_HANDOFF.md` first when it exists. Then read
`.claude/skills/gym-architecture/SKILL.md` before changing application code.
For every non-trivial UI change, also read `docs/DESIGN_SYSTEM.md` and
`.claude/rules/design-system.md`.

The application architecture is:

`routes and server actions -> services -> database and integrations`

Routes and actions validate, authorize, call services, and render or revalidate.
Business logic and database access belong in services. External providers stay
behind integration adapters. Reuse existing helpers, validation schemas, and UI
primitives before adding anything new.

All customer-facing copy is Czech. Do not invent business facts, contact data,
equipment, policies, opening hours, availability, reviews, or guarantees. Never
commit secrets or local environment files.

Use Node.js 22. Before finishing, run relevant format check, lint, typecheck,
tests, dependency audit, and production build.
Non-trivial UI work also requires responsive browser verification, keyboard
verification, visible focus, contrast, reduced motion, and design-system review.
