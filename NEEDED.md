# Co je potřeba dokončit mimo repozitář

Tento soubor obsahuje jen externí nebo klientské kroky. Implementovaný stav a
ověřovací příkazy jsou v [SESSION_HANDOFF.md](./SESSION_HANDOFF.md).

## Přehled úkolů pro administraci

Řádky níže čte administrační dashboard. `[imp:N]` značí prioritu od 1 do 5 a
`[owner:me]` znamená externí krok vlastníka projektu. `[owner:ai]` je úkol, který
lze dokončit v kódu po dodání potřebných podkladů.

- [ ] **Potvrdit cílový Supabase projekt a připojit databázi**: bez správného schématu neběží ostré přihlášení, rezervace ani administrace. `[imp:5]` `[owner:me]`
- [ ] **Nastavit Supabase Auth a callback URL**: produkční přihlášení vyžaduje povolený e-mail, správné URL a shodný seznam v `NEXT_PUBLIC_OAUTH_PROVIDERS`. `[imp:5]` `[owner:me]`
- [ ] **Doplnit produkční Vercel proměnné a doménu**: build funguje bez DB, provozní funkce ale potřebují správná tajemství a callbacky. `[imp:5]` `[owner:me]`
- [ ] **Aplikovat a ověřit migrace `0000` až `0003`**: migrace vytvářejí schéma, omezení překryvu rezervací a bezpečný Realtime signál. `[imp:5]` `[owner:me]`
- [ ] **Nastavit Stripe a webhook**: bez produkčních klíčů a podpisu nelze přijímat platby. `[imp:4]` `[owner:me]`
- [ ] **Připojit Nuki a fyzicky ověřit vstupní kód**: správnost nelze potvrdit bez skutečného zámku. `[imp:4]` `[owner:me]`
- [ ] **Nastavit Resend a WhatsApp**: doručení pokynů vyžaduje ověřené účty, domény a schválenou šablonu. `[imp:4]` `[owner:me]`
- [ ] **Vytvořit CMS Storage bucket a jeho policies**: nahrávání obrázků a dokumentů potřebuje cílové úložiště. `[imp:4]` `[owner:me]`
- [ ] **Nastavit cron, Sentry a uptime monitoring**: automatické opravy a upozornění potřebují produkční tajemství. `[imp:3]` `[owner:me]`
- [ ] **Dodat finální fotografie, kontakty, vybavení a provozní pravidla**: web záměrně nevymýšlí nepotvrzené údaje. `[imp:3]` `[owner:me]`
- [ ] **Dodat a schválit právní texty**: obchodní podmínky a ochranu soukromí musí potvrdit provozovatel nebo právník. `[imp:3]` `[owner:me]`
- [ ] **Spustit plné auth, admin a payment E2E proti testovacím službám**: lokální bezpečné demo nemůže ověřit cizí systémy. `[imp:2]` `[owner:ai]`
- [ ] **Doplnit analytics po rozhodnutí o consentu**: měření se nemá spouštět bez privacy rozhodnutí. `[imp:1]` `[owner:ai]`

## P0: správný Supabase projekt

Aktuální `.mcp.json` odkazuje na projekt `rkmunagymohxtclymacm`. Při poslední
kontrole jeho schéma neodpovídalo této aplikaci: chyběly tabulky NAMASTÉ a byly
v něm jiné struktury. Do projektu proto nic nemigrujte ani nemažte, dokud vlastník
výslovně nepotvrdí, že jde o správný cíl.

Po potvrzení cíle:

1. Nastavte `DATABASE_URL`, `DIRECT_URL`, veřejnou URL a publishable key.
2. Nastavte `SUPABASE_SECRET_KEY` jen v bezpečném serverovém prostředí.
3. Zkontrolujte a aplikujte migrace `0000` až `0003`.
4. Spusťte seed a ověřte databázové omezení proti překryvu rezervací.
5. Spusťte Supabase security a performance advisors.
6. Ověřte RLS a grants. Role `anon` ani `authenticated` nesmí číst provozní
   tabulky s osobními údaji. Veřejný Realtime smí číst jen
   `availability_signal`.
7. Založte Storage bucket podle `SUPABASE_STORAGE_BUCKET` a nastavte policies.
8. V Auth nastavte Site URL, callback URL a zvolené poskytovatele. Jejich názvy
   zapište také do `NEXT_PUBLIC_OAUTH_PROVIDERS` jako čárkou oddělený seznam
   `google`, `apple` a/nebo `azure`. Neověřený poskytovatel se ve formuláři
   záměrně nezobrazuje.

Migrace `drizzle/0003_security_and_realtime.sql` vytváří signál dostupnosti bez
osobních údajů, omezuje veřejná práva a přidává ochranu plateb. Před aplikací ji
porovnejte se skutečným schématem cílového projektu.

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
