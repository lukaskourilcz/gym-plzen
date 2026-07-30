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

## Session routine & markdown conventions

This repo follows a shared markdown contract (see the `session-start`,
`session-end`, and `markdown-checkup` skills under `.claude/skills/`):

- **`NEEDED.md`** — owner/agent action items. Each task:
  `- [ ] **Title** — desc. [imp:1-5] [owner:me|ai] [time:30m] [kind:K]`, where
  `[kind:K]` is one of `setup` `deploy` `legal` `content` `decision`.
- **`about-project.md`** — project summary + the tech stack.
- **`scaling.md`** — cost & scaling only (renamed from `stack-and-scaling.md`).
- **`monetization.md`** — how the project could earn (options table).

At session start, check `NEEDED.md` for `[owner:ai]` tasks that can now be done;
at session end, update `NEEDED.md` (finished + newly-needed owner items).

## Git workflow (every session)

- **Commit frequently** in small, coherent steps — never batch a whole session into one commit.
- **At the end of every session, push and merge to `main`** so the change redeploys immediately (this project auto-deploys from `main` on Vercel).
- **Delete the merged / old branch** (local and remote) after merging, to keep the repo clean. Never leave stale branches behind.
