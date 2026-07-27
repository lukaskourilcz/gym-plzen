# Co je potřeba dokončit mimo repozitář

Tento soubor obsahuje jen externí nebo klientské kroky. Implementovaný stav a
ověřovací příkazy jsou v [SESSION_HANDOFF.md](./SESSION_HANDOFF.md).

## Přehled úkolů pro administraci

Řádky níže čte administrační dashboard. `[imp:N]` značí prioritu od 1 do 5 a
`[owner:me]` znamená externí krok vlastníka projektu. `[owner:ai]` je úkol, který
lze dokončit v kódu po dodání potřebných podkladů.

- [ ] **Připojit Supabase v aplikaci a Vercelu**: schéma `rkmunagymohxtclymacm` je aplikované a ověřené, zbývá vyplnit `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `SUPABASE_SECRET_KEY` v `.env.local` a ve Vercelu. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:deploy]`
- [ ] **Nastavit Supabase Auth a callback URL**: produkční přihlášení vyžaduje povolený e-mail, správné URL a shodný seznam v `NEXT_PUBLIC_OAUTH_PROVIDERS`. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Doplnit produkční Vercel proměnné a doménu**: build funguje bez DB, provozní funkce ale potřebují správná tajemství a callbacky. `[imp:5]` `[owner:me]` `[time:2h]` `[kind:deploy]`
- [x] **Aplikovat a ověřit migrace `0000` až `0003`**: schéma, `btree_gist`, exclusion constraint, `auth.users` trigger, PII-safe realtime signal a RLS na 18 tabulkách jsou aplikované a ověřené SQL testy. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:deploy]`
- [ ] **Nastavit Stripe a webhook**: bez produkčních klíčů a podpisu nelze přijímat platby. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Připojit Nuki a fyzicky ověřit vstupní kód**: správnost nelze potvrdit bez skutečného zámku. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **Nastavit Resend a WhatsApp**: doručení pokynů vyžaduje ověřené účty, domény a schválenou šablonu. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:deploy]`
- [x] **Vytvořit CMS Storage bucket a jeho policies**: bucket `cms-media` je založený (public read, admin CUD přes `profiles.role='admin'`), pokus o upload pod `anon` i non-admin `authenticated` je RLS zamítnutý. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:deploy]`
- [ ] **Nastavit cron, Sentry a uptime monitoring**: automatické opravy a upozornění potřebují produkční tajemství. `[imp:3]` `[owner:me]` `[time:1h]` `[kind:deploy]`
- [ ] **Dodat finální fotografie, kontakty, vybavení a provozní pravidla**: web záměrně nevymýšlí nepotvrzené údaje. `[imp:3]` `[owner:me]` `[time:1h]` `[kind:content]`
- [ ] **Dodat a schválit právní texty**: obchodní podmínky a ochranu soukromí musí potvrdit provozovatel nebo právník. `[imp:3]` `[owner:me]` `[time:2h]` `[kind:legal]`
- [ ] **Spustit plné auth, admin a payment E2E proti testovacím službám**: lokální bezpečné demo nemůže ověřit cizí systémy. `[imp:2]` `[owner:ai]` `[time:1h]` `[kind:deploy]`
- [ ] **Doplnit analytics po rozhodnutí o consentu**: měření se nemá spouštět bez privacy rozhodnutí. `[imp:1]` `[owner:ai]` `[time:2h]` `[kind:legal]`
- [ ] **Zapnout Vercel Web Analytics pro tento projekt**: v projektu na Vercelu zapni Web Analytics, aby OwnDashboard v přehledu projektu ukazoval návštěvníky a zobrazení stránek (načítá je přes Vercel API podle tohoto repozitáře). `[imp:2]` `[owner:me]` `[time:15m]` `[kind:setup]`

## P0: správný Supabase projekt

Cíl `rkmunagymohxtclymacm` byl v seanci 2026-07-27 potvrzen jako prázdný, byly
aplikovány migrace `0000`–`0003` plus oprava advisorů `0004_advisor_fixes`,
proběhl seed a všechny hlavní bezpečnostní kontroly (overlap constraint, RLS,
grants, storage). Pořízená záloha stavu před migrací:
`~/Documents/gym-plzen-backups/pre-migrate-20260727T153620Z.txt`.

Otevřené kroky jsou v [MANUAL_STEPS.md](./MANUAL_STEPS.md):

1. Přejmenování projektu na `namasteplzen` v Supabase Dashboard.
2. Přidání `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a `SUPABASE_SECRET_KEY` do
   `.env.local` a Vercel Environment Variables.
3. V Auth nastavit Site URL, Redirect URLs a povolit e-mail + Google OAuth.
   Vyplnit `NEXT_PUBLIC_OAUTH_PROVIDERS` až po ověření providera.

`availability_signal` (PII-safe) je publikován do `supabase_realtime`, RLS je
zapnutý na 18 business tabulkách bez policies, `anon` a `authenticated` mají
SELECT pouze na `availability_signal`. `btree_gist` je v `extensions` schématu.
Exclusion constraint proti překryvu rezervací je aktivní.

## P0: produkční rezervace a platby

- Doplňte Stripe testovací a produkční klíče.
- Nastavte Stripe webhook na `/api/webhooks/stripe` pro dokončený, asynchronně
  úspěšný, asynchronně neúspěšný a expirovaný Checkout.
- Ověřte podpis, idempotenci, opakované doručení a expiraci pending rezervace.
- Zapněte Apple Pay a Google Pay a ověřte produkční doménu.
- Projděte celý tok s reálnou testovací platbou od rezervace po potvrzení.

## P0: chytrý zámek a doručení kódu

- Doplňte Nuki API token, ID zámku a ověřený webhook secret.
- Fyzicky otestujte vytvoření, časovou platnost a revokaci kódu.
- Doplňte Resend API key a ověřenou odesílací doménu.
- Nastavte WhatsApp Business účet, trvalý token, app secret, verify token a
  schválenou českou šablonu `access_code`.
- Připravte nouzový postup pro výpadek zámku nebo doručení.

## P1: produkční provoz

- Nastavte Vercel env podle `.env.example` a použijte Node.js 22.
- Doplňte `CRON_SECRET` a ověřte watchdog a synchronizační crony.
- Doplňte Sentry DSN a auth token pro source maps.
- Přidejte uptime monitor webu a heartbeat cronů.
- Nastavte produkční doménu, DNS, HTTPS a callback URL u všech poskytovatelů.
- Po nasazení ručně ověřte CSP, HSTS, frame protection a webhooky.

## P1: potvrzený obsah klienta

- Dodejte finální hero fotografii a galerii. CMS podporuje hero URL a alt text.
- Potvrďte e-mail a telefon. Web je záměrně nezobrazuje, dokud nejsou ověřené.
- Potvrďte seznam vybavení, otevírací dobu, kapacitu, pravidla hostů, dětí a
  storna. Adresa je `Křížkova 424/23, 301 00 Plzeň 1`.
- Dodejte finální logo soubory, pokud mají nahradit kódovou variantu.

## P1: právní a privacy obsah

Routes `/obchodni-podminky` a `/ochrana-soukromi` jsou připravené, ale záměrně
neobsahují vymyšlené údaje. Provozovatel nebo právník musí dodat a schválit:

- provozovatele, IČO, sídlo a kontaktní údaje;
- obchodní a storno podmínky;
- zásady ochrany soukromí, retention a právní titul zpracování;
- informace k platebnímu a přístupovému systému;
- rozhodnutí o cookies a analytics.

## P1: plné QA po připojení služeb

- Spusťte kompletní Playwright auth/admin suite s explicitním povolením
  vzdálených mutací podle [tests/e2e/README.md](./tests/e2e/README.md).
- Ověřte souběh dvou rezervací stejného slotu a vlastnictví dat účtu.
- Ověřte opuštěný, neúspěšný, zrušený a expirovaný Checkout.
- Ověřte Stripe, Nuki, e-mail a WhatsApp retries včetně alertů.

## P2: obsah a měření po spuštění

- Dodejte finální Open Graph obrázek.
- Nastavte Search Console a odešlete sitemapu.
- Analytics zapněte až po rozhodnutí o consentu a privacy textu.
- Po získání provozu zkontrolujte reálné Core Web Vitals.

## Bezpečné lokální demo

Lokálně lze v `.env.local` nastavit:

```dotenv
DEMO_AUTH_ENABLED="true"
DEMO_AUTH_SECRET="nahodny-retezec-alespon-32-znaku"
BOOKING_PREVIEW_FIXTURE="true"
```

Demo účty jsou jen pro lokální nebo preview prezentaci. Produkční politika je
vypne i tehdy, kdyby se proměnná omylem nastavila na `true`. Ilustrační kalendář
je jasně označený a v produkci se nezobrazí.

## Co do repozitáře nepatří

- databázová hesla;
- Supabase secret nebo service-role klíče;
- Stripe, Nuki, WhatsApp, Resend, Sentry a cron secrets;
- reálné exporty členů, plateb, logů nebo přístupových kódů;
- lokální `.env.local`.
