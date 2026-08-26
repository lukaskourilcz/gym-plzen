# NAMASTÉ Private Gym

Web, rezervační systém, členský účet a administrace pro soukromý gym na adrese
Křížkova 424/23, Plzeň - Roudná. Aplikace používá Next.js, Supabase, Stripe a
Nuki.

## Aktuální stav

Modernizovaný veřejný web s fotografií a přehledem nejbližší dostupnosti v hero,
měsíční výběr rezervací, lokální ukázkové účty, členský účet, CMS a administrace
jsou v repozitáři. Produkční build funguje i bez databáze, ale rezervace v takovém
případě poctivě zobrazí nedostupnou službu. Fiktivní dostupnost ani lokální demo
přihlášení se v produkci nezapnou.

Veřejný web používá klientské logo, provoz 5:00–23:45, 75minutové vstupy,
adresu Plzeň - Roudná, bílou cenovou kartu, klientské FAQ a kontaktní blok s
mapou. Instagram používá potvrzený profil `@namaste_plzen`. Telefon, e-mail a
Facebook jsou potvrzené; `info@namastegym.cz` zůstává zástupný e-mail do
potvrzení provozovatelkami.

Kód prošel produkčním buildem, lintem, typovou kontrolou, unit testy,
dependency auditem a kontrolou dead code. Ostrý provoz stále vyžaduje fyzické a
externí ověření Supabase, Stripe, Nuki a doručovacích kanálů a schválení
rozporných právních údajů. Aktuální checklist je v [NEEDED.md](./NEEDED.md).

## Hlavní části

- `/`: veřejný web, cena, způsob rezervace, pravidla, galerie, kontakt a mapa.
- `/rezervace`: měsíční date-first kalendář a přesné časové rozsahy slotů.
- `/login`: Supabase přihlášení a registrace; v lokálním vývoji také demo účty.
- `/forgot-password`, `/reset-password`: bezpečná obnova hesla přes Supabase Auth.
- `/account`: profil člena, věrnost a rezervace.
- `/admin`: chráněná administrace, CMS, rozvrh, rezervace, provozní přehledy a
  pět editovatelných e-mailových šablon s logem, náhledem a testovacím
  odesláním. Registrace a obnova hesla se přes serverový Supabase Management
  token synchronizují do Supabase Auth.
  Obsah webu je rozdělený do lidsky pojmenovaných sekcí; u každého aktuálního
  textu je samostatná ikona úprav bez technických CMS polí.
- `/faq`, `/vybaveni`: potvrzené informace bez domyšleného vybavení nebo pravidel.
- `/admin/design-system`: chráněná živá galerie design systému.

## Stack

| Oblast    | Technologie                                             |
| --------- | ------------------------------------------------------- |
| Web a API | Next.js 15 App Router, React 19, TypeScript             |
| Styl      | Tailwind CSS 4, vlastní semantic tokens, Bitter, Lucide |
| Databáze  | Supabase Postgres, Drizzle ORM                          |
| Auth      | Supabase Auth a `@supabase/ssr`                         |
| Platby    | Stripe Checkout                                         |
| Vstup     | Nuki Web API                                            |
| Zprávy    | Resend, WhatsApp Business, volitelně GoSMS              |
| Dohled    | Sentry a Vercel Cron                                    |
| Testy     | Node test runner s `tsx` loaderem, Playwright           |

## Požadavky

- Node.js `>=22.13 <23`
- npm 10 nebo novější
- Pro živé rezervace samostatný Supabase projekt s aplikovanými migracemi

## Lokální spuštění

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Bez databáze lze lokálně zapnout pouze ukázkové rozhraní:

```dotenv
DEMO_AUTH_ENABLED="true"
DEMO_AUTH_SECRET="nahodny-retezec-alespon-32-znaku"
BOOKING_PREVIEW_FIXTURE="true"
```

Demo přihlášení je záměrně dostupné jen mimo produkci. Přihlašovací formulář
neobsahuje banner s hesly.

- Administrace: `admin@namaste.demo`, heslo `namaste2026`
- Klientský účet: `klient@namaste.demo`, heslo `namaste2026`

OAuth tlačítka se zobrazí jen pro poskytovatele uvedené v
`NEXT_PUBLIC_OAUTH_PROVIDERS`, například `google,apple,azure`. Stejné
poskytovatele je nutné nejprve povolit v Supabase a nastavit jim callback URL.

## Ověření

```bash
npm run format:check
npm run lint
npm run deadcode
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high # navíc zkontroluje vývojový toolchain
```

E2E režimy a ochrana proti nechtěným zápisům do vzdálené databáze jsou popsány
v [tests/e2e/README.md](./tests/e2e/README.md).

## Architektura

```text
routes a server actions -> services -> databáze a integrace
                              |
                              -> sdílené helpery
```

Routes validují, autorizují a volají služby. Business logika a přístup k DB jsou
v `src/lib/services`. Adaptéry externích služeb jsou v `src/lib/integrations`.
Podrobnosti jsou v [.claude/skills/gym-architecture/SKILL.md](./.claude/skills/gym-architecture/SKILL.md).

## Dokumentace

- [NEEDED.md](./NEEDED.md): externí závislosti a ruční setup.
- [MANUAL_STEPS.md](./MANUAL_STEPS.md): produkční runbook pro externí konzole.
- [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md): závazný vizuální systém.
- [CLAUDE.md](./CLAUDE.md): pravidla pro další vývoj.

## Důležitá bezpečnostní pravidla

- Do repozitáře nepatří `.env.local`, přístupové tokeny ani tajné klíče.
- Prohlížeč nikdy nedostává Supabase secret key.
- Veřejný Realtime poslouchá jen PII-free tabulku `availability_signal`.
- Cena, trvání, člen, dostupnost a vlastnictví rezervace se ověřují na serveru.
- Každá admin stránka autorizuje roli před načtením dat; samotný layout není
  bezpečnostní hranice.
- Známé lokální demo identity se nikdy nepředávají do produkčního Supabase Auth.
- Migraci `drizzle/0003_security_and_realtime.sql` neaplikuj do projektu,
  dokud není ověřeno, že daný Supabase projekt skutečně patří této aplikaci.
