# Session handoff

Poslední aktualizace: 2026-07-23

Tento checkpoint uzavírá redesign, UX hardening, nezávislý audit a finální QA.
Je určený pro `main` po závěrečném fast-forward merge a pushi. Přesný Git stav
vždy ověř příkazy `git status`, `git log -1` a `git ls-remote origin main`.

## Výsledek

**GO pro klientskou prezentaci. NO-GO pro ostrý provoz.**

Veřejný web, ilustrační rezervace, lokální klientský účet a lokální administrace
jsou připravené k prezentaci bez Supabase. Produkční provoz zůstává blokovaný
externími službami, právními podklady, potvrzenými kontakty a potvrzenými
provozními časy. Úplný nezávislý verdikt a stav 18 nálezů je v
`docs/UX_AUDIT.md`.

## Co je hotové

- Modernizovaný veřejný web NAMASTÉ se skutečnou fotografií klienta, klidnou
  hierarchií, omezeným počtem CTA, adresou a Google mapou.
- Hero zobrazuje tři nejbližší dny a přesné rozsahy. Rozlišuje živou,
  ilustrační a nedostupnou dostupnost.
- `/rezervace` používá Monday-first date-first kalendář, přesné časy, délku,
  cenu, klávesnicové ovládání a akci `Zkusit znovu`.
- Produkce bez databáze nikdy nezobrazuje fiktivní dostupnost.
- Lokální demo login funguje bez Supabase pro administrátora i klienta. Demo
  cookies jsou podepsané, HttpOnly a v produkci vynuceně vypnuté.
- OAuth tlačítka se zobrazí jen podle `NEXT_PUBLIC_OAUTH_PROVIDERS` a chyby mají
  český feedback.
- Klientský účet má přehledné rezervace bez duplicitního času a používá stejný
  design systém jako veřejná část.
- Mobilní administrace má skupinové menu, aktivní route, Escape a návrat focusu.
- Admin demo používá stabilní lokální česká data bez DummyJSON nebo jiné síťové
  fixture služby.
- `Inspirace` a `Plán spuštění` zůstávají v administraci. Plán rozlišuje
  `Kód připraven` a `Ověřuje se` a připravenost nepřekračuje 60 %.
- Skip link obchází veřejnou navigaci i při streamingu. Každá hotová route má
  jediný focusovatelný `main-content`; loading landmark jeho ID neduplikuje.
- Veřejné i admin menu, focus, reduced motion, 44px cíle, kontrast a responsive
  reflow mají regresní pokrytí.
- Canonical design systém je v `docs/DESIGN_SYSTEM.md`; živý kit je na
  `/admin/design-system`.
- Security headers, CSP, PII-free Realtime signal, log redakce, serverové
  přepočítání slotu a ceny, Stripe webhook idempotence a upload validace jsou
  implementované.

## Lokální ukázka

V `.env.local` nastav:

```dotenv
DEMO_AUTH_ENABLED="true"
DEMO_AUTH_SECRET="nahodny-retezec-alespon-32-znaku"
BOOKING_PREVIEW_FIXTURE="true"
```

Účty:

- administrace: `admin@namaste.demo`, heslo `namaste2026`;
- klient: `klient@namaste.demo`, heslo `namaste2026`.

Přihlašovací stránka tyto údaje záměrně nevypisuje. Produkční politika demo
zakáže i při chybně nastavené proměnné.

## Finální ověření

Prošlo na Node.js 22:

```text
npm run format:check              pass
npm run lint                      pass
npm run typecheck                 pass
npm test                          17/17
npm run build                     pass
lokální demo/public Playwright    10 passed, 0 failed
nezávislý finální Playwright      10 passed, 0 failed, 24 gated skipped
produkční public Playwright       7 passed, 1 expected skipped
skip navigation stress            10/10 implementace, 5/5 review
mobilní login target              3/3 review, nejméně 44 px
npm audit --audit-level=high      exit 0, 4 moderate pouze dev Drizzle chain
npm audit --omit=dev              0 vulnerabilities
```

Produkční Lighthouse na `127.0.0.1:3131`:

| Kategorie      | Skóre |
| -------------- | ----: |
| Performance    |    94 |
| Accessibility  |   100 |
| Best practices |   100 |
| SEO            |   100 |

Ověřené viewporty: 320, 390, 667 landscape, 768, 1024, 1280, 1440 a 1728 px.
Zkontrolován byl také 640px reflow jako praktický ekvivalent 200% zoomu. Před
produkcí ještě proveď doslovný 200% browser zoom a screen-reader poslech v
cílových prohlížečích.

## Co zůstává v kódu

- Nízkoprioritní P3: globální loading skeleton je obecný, ne route-specific.
  Nefunguje špatně a neblokuje demo, ale route skeletony by snížily layout shift.
- CSP stále potřebuje `unsafe-inline` kvůli současnému Next hydration setupu.
  Nejde o nonce CSP.
- `npm audit` hlásí čtyři moderate dev-only nálezy přes Drizzle Kit a legacy
  esbuild loader. `npm audit fix --force` by provedl breaking downgrade.
- Finální galerie, kontakty, vybavení a právní texty se nesmí domýšlet.

## Databáze a externí blokátory

Nakonfigurovaný Supabase projekt `rkmunagymohxtclymacm` při poslední kontrole
neobsahoval schéma této aplikace. Do něj nic nemigruj, nemaž ani neseeduj, dokud
vlastník výslovně nepotvrdí správný cíl. Migrace `0000` až `0003` jsou připravené
lokálně, ale vzdáleně nebyly aplikované.

Aktuální externí práce je vedena pouze v `NEEDED.md`:

1. potvrdit správný Supabase projekt, env a migrace;
2. ověřit Auth, RLS, overlap a vlastnictví dat;
3. připojit a end-to-end otestovat Stripe, Nuki, Resend a WhatsApp;
4. dodat schválené právní texty;
5. dodat skutečný e-mail a telefon, nikoli Wix template údaje;
6. potvrdit provozní časy, vybavení, pravidla a finální fotografie;
7. nastavit Vercel, doménu, Sentry, cron a uptime monitoring.

## Doporučený začátek další práce

1. Ověř čistý `main` a úspěšný poslední Vercel deployment.
2. Přečti `NEEDED.md`, `docs/UX_AUDIT.md`, `docs/DESIGN_SYSTEM.md` a
   `.claude/skills/gym-architecture/SKILL.md`.
3. Vyžádej si potvrzený cílový Supabase project ref. Bez něj neprováděj remote
   SQL ani mutační E2E.
4. Po připojení služeb spusť plnou gated suite podle `tests/e2e/README.md`.
5. Před produkcí uzavři všechny `EXTERNALLY BLOCKED` položky z UX auditu a
   `NEEDED.md`.

## Důležité checkpointy

- `ffdbabe`: canonical design systém.
- `93b2c99`: hlavní modernizace aplikace.
- `4c3fdf3`: merge live hero kalendáře z tehdejšího `main`.
- `20bc6da`: první nezávislý UX audit.
- `ea3e2e4`: remediation P1 a P2.
- `d41507e`: stabilní skip navigace při streamingu.
- `45aaa2f`: 44px mobilní login target.

Další agent nemá opakovat hotový redesign. Má pokračovat externím setupem nebo
novým explicitním zadáním a zachovat zdokumentované bezpečnostní a UX invarianty.
