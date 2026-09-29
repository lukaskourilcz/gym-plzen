# NAVI Private Gym

Web, rezervační systém, členský účet a administrace pro soukromý gym na adrese
Křížkova 424/23, Plzeň - Roudná. Aplikace používá Next.js, Supabase, Comgate a
Nuki.

## Aktuální stav

Modernizovaný veřejný web s fotografií a přehledem nejbližší dostupnosti v hero,
měsíční výběr rezervací, lokální ukázkové účty, členský účet, CMS a administrace
jsou v repozitáři. Produkční build funguje i bez databáze, ale rezervace v takovém
případě poctivě zobrazí nedostupnou službu. Fiktivní dostupnost ani lokální demo
přihlášení se v produkci nezapnou.

Veřejný web používá klientské logo, provoz 5:00–23:45, 75minutové vstupy,
adresu Plzeň - Roudná, bílou cenovou kartu, klientské FAQ a kontaktní blok s
mapou. Instagram používá potvrzený profil `@navi_plzen`. Telefon, e-mail a
Facebook jsou v produkčním CMS doplněné potvrzenými hodnotami.

Nezávislý finální UX audit dává **GO pro klientskou prezentaci** a **NO-GO pro
produkci**, dokud nejsou připojené a ověřené externí služby a schválené právní
texty. Podrobnosti a stav všech nálezů jsou v
[docs/UX_AUDIT.md](./docs/UX_AUDIT.md).

Pro další práci začni v [SESSION_HANDOFF.md](./SESSION_HANDOFF.md). Externí
nastavení a chybějící klientské podklady jsou v [NEEDED.md](./NEEDED.md).

## Hlavní části

- `/`: veřejný web, cena, způsob rezervace, pravidla, galerie, kontakt a mapa.
- `/rezervace`: měsíční date-first kalendář a přesné časové rozsahy slotů;
  výběr až 10 termínů najednou, které se zaplatí jednou objednávkou
  (`services/orders.ts`, plán v `docs/MULTI_SLOT_ORDER_PLAN_2026_09_28.md`).
- `/login`: Supabase přihlášení a registrace; v lokálním vývoji také demo účty.
- `/forgot-password`, `/reset-password`: bezpečná obnova hesla přes Supabase Auth.
- `/account`: profil člena, věrnost a rezervace.
- `/admin`: chráněná administrace, CMS, rozvrh, rezervace, provozní přehledy,
  profil každého člena (kontakt, věrnost, historie rezervací a odeslaných
  zpráv), historie akcí po stránkách (potvrzené, zrušené a přesunuté rezervace,
  platby a změny provedené správcem) a sedm editovatelných e-mailových šablon
  s logem, náhledem a testovacím odesláním. Registrace a obnova hesla se přes serverový Supabase Management
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
| Platby    | Comgate REST API 2.0 (hostovaná brána)                  |
| Vstup     | Nuki Web API                                            |
| Zprávy    | Resend, WhatsApp Business, volitelně GoSMS              |
| Dohled    | Sentry a Vercel Cron                                    |
| Testy     | Node test runner přes `tsx`, Playwright                 |

## Požadavky

- Node.js `>=22.13 <23`
- npm 10 nebo novější
- Pro živé rezervace samostatný Supabase projekt s aplikovanými migracemi

## Lokální spuštění

```bash
npm install
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
- Tyto účty fungují jen v lokálním demo režimu (`DEMO_AUTH_ENABLED`, mimo
  produkci). Ve skutečném Supabase projektu nesmí existovat; produkční kopie
  byly 29. 9. 2026 smazány.

OAuth tlačítka se zobrazí jen pro poskytovatele uvedené v
`NEXT_PUBLIC_OAUTH_PROVIDERS`, například `google,apple,azure`. Stejné
poskytovatele je nutné nejprve povolit v Supabase a nastavit jim callback URL.

## Ověření

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm audit --audit-level=high
npm audit --omit=dev
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

- [SESSION_HANDOFF.md](./SESSION_HANDOFF.md): přesný checkpoint pro dalšího agenta.
- [NEEDED.md](./NEEDED.md): externí závislosti a ruční setup.
- [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md): závazný vizuální systém.
- [docs/INSPIRATIONS.md](./docs/INSPIRATIONS.md): historická rešerše konkurence.
- [docs/TOOLING.md](./docs/TOOLING.md): rozhodnutí o nástrojích a balíčcích.
- [docs/UX_AUDIT.md](./docs/UX_AUDIT.md): nezávislý UX audit a stav nálezů.
- [CLAUDE.md](./CLAUDE.md): pravidla pro další vývoj.

## Důležitá bezpečnostní pravidla

- Do repozitáře nepatří `.env.local`, přístupové tokeny ani tajné klíče.
- Prohlížeč nikdy nedostává Supabase secret key.
- Veřejný Realtime poslouchá jen PII-free tabulku `availability_signal`.
- Cena, trvání, člen, dostupnost a vlastnictví rezervace se ověřují na serveru.
- Migraci `drizzle/0003_security_and_realtime.sql` neaplikuj do projektu,
  dokud není ověřeno, že daný Supabase projekt skutečně patří této aplikaci.
