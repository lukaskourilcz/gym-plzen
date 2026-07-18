# Gym Plzeň — rezervační systém a administrace

Web, rezervační systém a redakční systém (CMS) pro jednomístný gym v Plzni.
Členové si rezervují a platí trénink online, dostanou časově omezený vstupní kód
na chytrý zámek (Nuki) přes e-mail/WhatsApp, a administrace umožňuje spravovat
obsah webu, rezervace, členy, ceny a sledovat spolehlivost systému.

> **Stav:** kompletní kostra a architektura + plná administrace (backend).
> Vizuální design veřejného webu a live kalendář jsou další fází — viz plán.

## Tech stack

| Vrstva            | Technologie                                            |
| ----------------- | ------------------------------------------------------ |
| Web / API         | Next.js (App Router, Server Actions), TypeScript       |
| Databáze          | Supabase Postgres přes Drizzle ORM                     |
| Autentizace       | Supabase Auth (email/heslo + Google/Apple/Microsoft)   |
| Platby            | Stripe (jednorázový vstup, Apple/Google Pay)           |
| Zámek             | Nuki Web API                                           |
| E-maily           | Resend                                                 |
| WhatsApp / SMS    | WhatsApp Business Cloud API / GoSMS (volitelně)        |
| Monitoring        | Sentry + UptimeRobot                                   |
| Hosting           | Vercel (+ Vercel Cron)                                 |

## Obchodní model

Jednorázový vstup **290 Kč** (cena editovatelná v administraci). **Žádná měsíční
předplatná.** Každý **10.** vstup zdarma — člen vidí počítadlo návštěv a kolik
zbývá do vstupu zdarma (`components/loyalty-widget.tsx`). Kadenci lze změnit v
`src/lib/config/pricing.ts`.

## Rychlý start

```bash
npm install
cp .env.example .env.local     # vyplň podle NEEDED.md
npm run db:migrate             # vytvoří schéma + constraint proti překrývání
npm run db:seed                # otevírací doba, výchozí obsah, cena vstupu
npm run dev                    # http://localhost:3000
```

Po registraci účtu se povyš na administrátora:

```bash
npm run set-admin -- tvuj@email.cz
```

**Než něco poběží, projdi [`NEEDED.md`](./NEEDED.md)** — seznam všech účtů,
klíčů a webhooků, které je potřeba nastavit ručně.

## Struktura projektu

```
src/
├── app/
│   ├── (public)        úvod, přihlášení, účet člena (skeleton)
│   ├── admin/          administrace — rezervace, obsah, členové, ceny, …
│   └── api/
│       ├── auth/callback Supabase OAuth callback
│       ├── webhooks/   stripe · nuki · whatsapp
│       └── cron/       watchdog · sync-entry-log
├── components/         sdílené UI (admin form-controls, loyalty-widget)
└── lib/
    ├── auth/guards.ts  Supabase Auth guards
    ├── supabase/       Supabase server/client/middleware
    ├── config/         laditelné konstanty (pricing)
    ├── db/             Drizzle schéma, klient, typy
    ├── env.ts          typově bezpečné env proměnné (Zod)
    ├── helpers/        znovupoužitelné helpery (http, form, crypto, …)
    ├── integrations/   adaptéry externích služeb
    ├── services/       business logika (jediná vrstva k DB + integracím)
    └── validations/    Zod schémata formulářů
```

Architektura a konvence detailně: `.claude/skills/gym-architecture/SKILL.md`.

**Formuláře** používají **React Hook Form + Zod** (stejné Zod schéma na klientu
i serveru, viz `components/admin/use-action-form.ts`). Rešerše konkurence
(gymy bez obsluhy se zámkem) je v [`docs/INSPIRATIONS.md`](./docs/INSPIRATIONS.md)
a prohlížitelně v administraci pod **Inspirace**.

## Skripty

| Příkaz                        | Popis                                        |
| ----------------------------- | -------------------------------------------- |
| `npm run dev`                 | Vývojový server                              |
| `npm run build`               | Produkční build                              |
| `npm run typecheck`           | `tsc --noEmit`                               |
| `npm run db:generate`         | Vygeneruje migraci ze změn schématu          |
| `npm run db:migrate`          | Aplikuje migrace                             |
| `npm run db:seed`             | Naplní výchozí data                          |
| `npm run db:studio`           | Drizzle Studio                               |
| `npm run set-admin -- <email>`| Povýší uživatele na admina                   |

## Práce s Claude Code

- Subagenti: `admin-module-builder`, `integration-builder` (`.claude/agents/`).
- Commandy: `/new-admin-module`, `/add-integration`, `/db-migrate`.
- Skill s architekturou se načte automaticky při práci v repu.
