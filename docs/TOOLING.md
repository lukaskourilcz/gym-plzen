# Tooling evaluation: what is worth adopting for this project

> Research snapshot compiled 2026-07-18. External pricing, maintenance and
> licensing can change, so revalidate before spending money. Every verdict
> is tied to **this** project: a single-occupancy gym booking system on the
> current stack **Next.js/Vercel · Supabase Auth/Postgres · Stripe · Resend ·
> WhatsApp Business API · Nuki · Sentry · React Hook Form + Zod**, with member +
> payment-adjacent data required to stay in the **EU**.
>
> Verdict key: **USE** (adopt), **MAYBE** (situational), **SKIP** (not for us).

> Project status 2026-07-23: the codebase uses its own semantic UI primitives,
> not shadcn generators at runtime. FullCalendar remains admin-only. Public
> booking uses a lightweight custom monthly grid. This document is research,
> not an instruction to add dependencies without a measured need.

## TL;DR: adopt these

| Where               | Adopt (USE)                                                                             | Consider (MAYBE)                                       |
| ------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Marketing site      | shadcn/ui, tweakcn (theme), v0 (scaffold)                                               | Magic UI, Land-book, Godly, Ideogram (OG text), Stitch |
| Booking UI          | shadcn/ui, Origin UI (date/time pickers)                                                | Kibo UI (calendar _shell_ only), Mobbin (flows)        |
| Admin dashboard     | shadcn/ui, Tremor (charts, copy-paste), Origin UI                                       | Kibo UI (kanban/gantt)                                 |
| Reliability / jobs  | _keep Vercel Cron + Supabase pipeline_                                                  | Upstash QStash (only if retry/DLQ becomes a burden)    |
| Monitoring          | UptimeRobot, PageSpeed Insights, Sentry (locked)                                        | Better Stack (heartbeats + status page)                |
| Security            | Security Headers, MDN HTTP Observatory (both manual)                                    | :                                                      |
| Dev workflow        | Context7, Stripe MCP (official), Supabase MCP (official), PulseMCP, awesome-claude-code | Smithery                                               |
| Dev data            | Local deterministic TypeScript fixtures, Mockaroo (offline seed generation)             | free-for.dev (reference only)                          |
| AI support (future) | Gemini via **Vertex AI** (EU region + DPA)                                              | OpenRouter (enterprise DPA only)                       |

**Already aligned in this repo:** no-overlap is enforced by a **DB exclusion
constraint + Supabase**, not a component (correct per the research); the
reliability pipeline already runs on **Vercel Cron + a Supabase table** (so
QStash is optional, not needed); all forms already use **RHF + Zod**.

---

## UI / component libraries

All are build-time code you copy in: **N/A for GDPR** (no member data leaves the app).

| Tool                  | Maintained                                             | Free tier / price                  | Licence                     | Verdict: reason                                                                                                                                                   |
| --------------------- | ------------------------------------------------------ | ---------------------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **shadcn/ui**         | Very active                                            | Free                               | MIT                         | **USE**: foundation for all three surfaces.                                                                                                                       |
| **Origin UI**         | Active (rebranded 2026, some parts on Base UI)         | Free                               | MIT                         | **USE**: date/time pickers, selects, dialogs that pair with RHF+Zod; fills shadcn's gaps for booking + admin forms.                                               |
| **Tremor**            | Maintained; **acquired by Vercel**, npm lib now legacy | Free (copy-paste + blocks)         | Apache-2.0 / MIT            | **USE**: admin charts (payment/visit history). Adopt the copy-paste components, **not** `@tremor/react`.                                                          |
| **Kibo UI**           | Active                                                 | Free                               | MIT                         | **MAYBE**: good visual calendar/kanban/gantt shell for booking overview, but it only _renders_; overlap + realtime must come from Supabase. Not a booking engine. |
| **Magic UI**          | Active                                                 | Free core; Pro ~$149–199 one-time  | MIT (core)                  | **MAYBE**: marketing polish only; client components, keep off RSC paths. Free tier is enough.                                                                     |
| **awesome-shadcn-ui** | Active                                                 | Free                               | MIT                         | **USE**: discovery index when hunting a specific component. Not shipped.                                                                                          |
| **Aceternity UI**     | Active                                                 | Free tier; Pro ~$199 one-time      | permissive/free + paid      | **MAYBE (lean SKIP)**: heavy Framer-Motion hero theatrics a neighbourhood gym doesn't need; cherry-pick one free effect at most.                                  |
| **ReactBits**         | Active                                                 | Free                               | ⚠️ **MIT + Commons Clause** | **MAYBE**: occasional marketing accents; fine to use, but _not_ plain MIT (can't resell the library).                                                             |
| **21st.dev**          | Active                                                 | Free (credit-limited); Pro ~$20/mo | per-component (varies)      | **MAYBE**: dev-time AI component generator; redundant given shadcn + Origin + Kibo + Tremor already cover needs.                                                  |

---

## AI build / design tools

Build-time: **N/A for member data.** Watch training-on-inputs; don't paste secrets.

| Tool              | Maintained                           | Free tier / price                                                                                    | Licence / IP                      | Verdict: reason                                                                                                                                                                                |
| ----------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **v0 by Vercel**  | Very active                          | Free ($5 credit, 7 msg/day); **Plus $30/user/mo** (token-based since Feb 2026)                       | You own the output (shadcn = MIT) | **USE**: outputs the exact stack (Next.js + Tailwind + shadcn, Supabase-aware). Best accelerator for pages/booking UI/admin, finish in Claude Code. No-training only guaranteed at Enterprise. |
| **tweakcn**       | Active (~10k★)                       | Free editor + CSS export; paid = AI gen                                                              | Open source                       | **USE**: exports shadcn CSS-variable tokens straight into `globals.css`. Lock the gym brand once across all surfaces.                                                                          |
| **Google Stitch** | Active (Google **Labs**: no SLA)     | Free, ~550 gen/mo                                                                                    | Google gen-AI terms               | **MAYBE**: design exploration only; exports generic Tailwind/HTML, not shadcn. Whiteboard, not code source.                                                                                    |
| **Onlook**        | OSS active; **hosted = closed beta** | Self-host free (Apache-2.0); hosted TBD                                                              | Apache-2.0                        | **MAYBE→SKIP**: visual editor overlaps a Claude Code workflow; hosted product not GA.                                                                                                          |
| **Recraft**       | Active                               | Free = **no SVG export, no commercial rights, outputs public**; Basic $10/mo unlocks SVG + ownership | Paid = full commercial ownership  | **MAYBE (paid, one-off)**: only if you need original editable SVG icons/logo; check Lucide first. Free tier unusable here.                                                                     |
| **Ideogram**      | Active (v3)                          | Free ~10 prompts/day (commercial OK, public); Basic $7/mo                                            | Paid = full commercial licence    | **MAYBE (free likely enough)**: narrow: text-bearing OG image / wordmark. Prefer Lucide/Recraft SVG for icons.                                                                                 |

---

## Reliability / jobs: Upstash QStash vs. Vercel Cron + Supabase

**Recommendation: keep Vercel Cron + the Supabase pipeline table; QStash is optional.**

- **Send door code ~15 min before slot:** a **Vercel Cron every minute** (Pro
  gives minute granularity) that queries Supabase for slots starting soon with
  no code sent is precise enough. Per-message scheduling buys no real accuracy
  and keeps a third party out of payment-adjacent EU data.
- **paid → code-created → code-delivered pipeline:** QStash _would_ give
  at-least-once delivery, retry-with-backoff, and a dead-letter queue for free :
  but this repo already models that as an idempotent Supabase pipeline advanced
  by cron, all in the EU.

| Tool               | Maintained | Free tier / price                                              | EU/GDPR                                                                      | Verdict                                                                                                                                                 |
| ------------------ | ---------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Upstash QStash** | Active     | Free 1,000 msg/day (retries count), 10 schedules; PAYG $1/100k | EU regions (Frankfurt/Ireland) + published DPA, **but US CLOUD Act applies** | **MAYBE (default: skip)**: adopt only if hand-rolled retry/DLQ becomes a burden; if so, put **only booking-ID (no PII)** in payloads, pin EU, sign DPA. |

---

## Monitoring & performance

Analysis/prober tools: they hit your **public** endpoints, no member data stored.

| Tool                   | Maintained          | Free tier / price                                                                | Verdict: reason                                                                                                                                                                  |
| ---------------------- | ------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **UptimeRobot**        | Active              | Free: 50 monitors, 5-min checks, 1 status page                                   | **USE**: baseline prober for the app, a Supabase health endpoint, and a **cron heartbeat** (alerts if the 15-min job stops). Route alerts to the WhatsApp group.                 |
| **PageSpeed Insights** | Google              | Free (API 25k/day)                                                               | **USE**: free CWV/SEO spot-check. (Single-gym site likely lacks CrUX field data → rely on lab scores.)                                                                           |
| **Better Stack**       | Active              | Free: 10 monitors + 10 heartbeats, 1 status page, 3 GB logs; uptime from ~$29/mo | **MAYBE**: pick _instead of_ UptimeRobot if you want heartbeats + on-call escalation + public status page in one; choose EU region, scrub PII from logs. Don't duplicate Sentry. |
| **WebPageTest**        | Active (Catchpoint) | Free 300 runs/mo; API is paid                                                    | **MAYBE**: overkill; only for a specific waterfall debug.                                                                                                                        |
| **DebugBear**          | Active              | Free standalone tools; monitoring $125+/mo                                       | **MAYBE (free tools) / SKIP (paid)**: ad-hoc INP/TTFB checks; paid unjustified for one site.                                                                                     |

---

## Security (GDPR + payments)

Both scan **public** response headers only: no member data stored.

| Tool                     | Maintained                                        | Free | Verdict: reason                                                                       |
| ------------------------ | ------------------------------------------------- | ---- | ------------------------------------------------------------------------------------- |
| **Security Headers**     | Scanner active; **API being retired (~Apr 2026)** | Free | **USE (manually)**: verify CSP/HSTS on Vercel. Don't wire the deprecated API into CI. |
| **MDN HTTP Observatory** | Active (Mozilla, OSS)                             | Free | **USE (manually)**: stricter cross-check pre-launch.                                  |

---

## Claude Code / MCP (build workflow)

Dev workflow: **N/A for member data** (only queries/public docs), _unless_ you run a hosted server that touches real data.

| Tool                        | Maintained       | Free tier / price                                      | Verdict: reason                                                                                                          |
| --------------------------- | ---------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| **Context7**                | Active (Upstash) | Free cut to **1,000 calls/mo** (60/hr); Pro $7/seat/mo | **USE**: current-version docs for Stripe/Supabase/Next.js in Claude Code; 1,000/mo suffices for one dev.                 |
| **Stripe MCP** (official)   | Active           | Free (`npx @stripe/mcp` or `mcp.stripe.com`)           | **USE**: customers/payments/subscriptions/refunds/doc search.                                                            |
| **Supabase MCP** (official) | Active           | Free (`mcp.supabase.com/mcp`)                          | **USE**: SQL/schema/migrations/logs; **scope to dev + read-only** (it can touch real data).                              |
| **PulseMCP**                | Active           | Free directory                                         | **USE**: free reference to vet servers.                                                                                  |
| **awesome-claude-code**     | Active (~50k★)   | Free                                                   | **USE**: high-signal reference for skills/commands/MCP.                                                                  |
| **Smithery**                | Active           | Free browse/CLI; hosted = paid                         | **MAYBE**: discovery; you'll mostly install official servers directly.                                                   |
| **Nuki MCP**                | :                | :                                                      | **SKIP (doesn't exist)**: integrate the **Nuki Web API** directly (this repo already does).                              |
| **WhatsApp MCP**            | community only   | :                                                      | **SKIP**: unofficial WhatsApp-Web/personal-account bridges, wrong surface + ToS risk. Use the **Business API** directly. |

---

## Dev data / reference

| Tool             | Maintained | Free tier / price                          | Verdict: reason                                                                                                                                                                                     |
| ---------------- | ---------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mockaroo**     | Active     | Free 1,000 rows/download; paid from $60/yr | **USE**: seed synthetic members/bookings (keep it synthetic; never derive schemas from real member data).                                                                                           |
| **free-for.dev** | Active     | Free                                       | **USE (reference)**: spot free-tier ancillary services.                                                                                                                                             |
| **DummyJSON**    | Active     | Free                                       | **SKIP**: a remote English fixture made the Czech client demo look generic and introduced an avoidable network dependency. `src/lib/demo/dummy.ts` now contains deterministic local Czech fixtures. |

The current demo fixtures are local, stable and synthetic. They make every admin
section reviewable without a remote service, never derive from real member data
and remain explicitly labelled as illustrative data in the interface.

---

## Optional: AI-assisted WhatsApp support replies (GDPR-sensitive)

Routing real customer messages (personal data) through a US inference API triggers GDPR (Chapter V transfers, processor DPA, retention/training).

| Tool              | Free tier / price                                                                                    | EU/GDPR                                                                | Verdict: reason                                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Gemini** | Free tier (trains on inputs by default globally; **EEA/UK/CH exempt from training**); paid per token | Cleanest via **Vertex AI**: EU region, DPA, zero-retention             | **USE (only via paid Gemini API / Vertex AI, EU region + DPA)**: most defensible path. Don't use free-tier default for live messages. |
| **OpenRouter**    | PAYG from $10                                                                                        | ZDR by default, but **signed DPA + EU routing = enterprise tier only** | **MAYBE**: best control surface; clean for live personal data only at enterprise. Base tier OK for synthetic/redacted testing.        |
| **Groq**          | Free ~1,000 req/day; paid from ~$0.05/1M tok                                                         | **US inference, no EU endpoint, no free-tier privacy SLA**             | **SKIP** for live customer data: speed-only prototyping at most.                                                                      |

---

## Design inspiration

**N/A for GDPR** (inspiration only: don't copy proprietary UI verbatim).

| Tool          | Free tier / price      | Verdict: reason                                                                            |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| **Land-book** | Free Basic; Pro ~$6/mo | **USE (free)**: gym landing-page inspiration.                                              |
| **Godly**     | Free                   | **USE (free)**: visual polish (its avant-garde bias may exceed a conversion site's needs). |
| **Mobbin**    | Free tier; Pro $10/mo  | **MAYBE**: best for booking/fitness _flows_; one month of Pro if you want deep flow study. |

---

## Flagged: dead or materially changed since common knowledge

- **v0** → token-based pricing (Feb 2026); entry paid tier now **Plus $30/user/mo** (not the old "$20 Premium"); added a Next.js/Supabase sandbox. No-training only at Enterprise.
- **Tremor** → **acquired by Vercel**; `@tremor/react` npm lib is legacy: use the copy-paste components (now free/MIT).
- **Origin UI** → rebranded in 2026, some components moved onto **Base UI**; verify you're copying the Tailwind/shadcn variant.
- **ReactBits** → **MIT + Commons Clause**, not plain MIT.
- **Security Headers** → programmatic **API being discontinued (~Apr 2026)**; the web scanner still works: use it manually.
- **Context7** → free tier cut to **1,000 calls/mo** (early 2026).
- **Recraft** → free tier can't export SVG and grants no commercial rights (outputs public, Recraft-owned).
- **Onlook** → hosted product regressed to **closed beta / contact-us**.
- **Tremor / Stitch / v0** are the moving targets; re-check pricing before committing budget.
