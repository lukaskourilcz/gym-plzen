# Co je potřeba dokončit mimo repozitář

Tento soubor obsahuje jen externí nebo klientské kroky. Stav rozpracovaného kódu
je v [SESSION_HANDOFF.md](./SESSION_HANDOFF.md).

## P0: správný Supabase projekt

Aktuální `.mcp.json` odkazuje na projekt `rkmunagymohxtclymacm`. Při poslední
kontrole jeho schéma neodpovídalo této aplikaci. Obsahoval jiné tabulky a chyběly
gym tabulky. Do tohoto projektu proto nic nemigruj ani nemaž bez potvrzení
vlastníka a účelu.

Je potřeba:

1. Potvrdit správný Supabase projekt pro NAMASTÉ Private Gym nebo založit nový.
2. Nastavit `DATABASE_URL`, `DIRECT_URL`, veřejnou URL a publishable key.
3. Nastavit serverový `SUPABASE_SECRET_KEY` pouze v bezpečném serverovém prostředí.
4. Zkontrolovat SQL všech migrací a aplikovat `0000` až `0003` do správného projektu.
5. Spustit seed a ověřit constraint proti překryvu rezervací.
6. Spustit Supabase security a performance advisors.
7. Ověřit RLS a grants. `anon` ani `authenticated` nesmí číst provozní tabulky
   s osobními údaji. Veřejný Realtime smí číst jen `availability_signal`.
8. Založit Storage bucket podle `SUPABASE_STORAGE_BUCKET` a nastavit jeho policies.
9. V Supabase Auth nastavit Site URL, callback URL a požadované poskytovatele.

Migrace `drizzle/0003_security_and_realtime.sql` vytváří PII-free signal pro
obnovu dostupnosti, omezuje veřejná práva a přidává ochranu plateb. Před aplikací
ji zkontroluj proti skutečnému schématu cílového projektu.

## P0: produkční rezervace a platby

- Stripe test a production keys.
- Stripe webhook na `/api/webhooks/stripe` minimálně pro dokončený, asynchronně
  úspěšný, asynchronně neúspěšný a expirovaný Checkout.
- Ověřit podpis, idempotenci, opakované doručení a expiraci pending rezervace.
- Nastavit Apple Pay a Google Pay v Stripe a ověřit produkční doménu.
- Projít celý tok s reálnou testovací platbou od rezervace po potvrzení.

## P0: chytrý zámek a doručení kódu

- Nuki API token, ID zámku a ověřený webhook secret.
- Fyzicky otestovat vytvoření, časovou platnost a revokaci kódu.
- Resend API key a ověřená odesílací doména.
- WhatsApp Business účet, trvalý token, app secret, verify token a schválená
  česká šablona `access_code`.
- Nastavit nouzový provozní postup pro případ výpadku zámku nebo doručení.

## P1: produkční provoz

- Vercel env podle `.env.example`; produkční Node.js 22.
- `CRON_SECRET` a ověření watchdog a sync cronů.
- Sentry DSN a auth token pro source maps.
- Uptime monitor na web a heartbeat cronů.
- Produkční doména, DNS, HTTPS a callback URL ve všech poskytovatelích.
- Po nasazení ručně ověřit CSP, HSTS, frame protection a webhooky.

## P1: potvrzený obsah klienta

- Finální hero fotografie a galerie. Kód podporuje CMS hero URL a alt text.
- Potvrzený e-mail a telefon. Veřejný web je schválně nezobrazuje, dokud nejsou
  potvrzené. Adresa je `Křížkova 424/23, 301 00 Plzeň 1`.
- Potvrzený seznam vybavení.
- Potvrzená otevírací doba, kapacita, pravidla hostů, dětí a storna.
- Finální logo soubory, pokud mají nahradit kódovou variantu.

## P1: právní a privacy obsah

Routes `/obchodni-podminky` a `/ochrana-soukromi` jsou připravené, ale záměrně
neobsahují vymyšlené údaje. Je potřeba dodat:

- provozovatele, IČO, sídlo a kontaktní údaje;
- obchodní a storno podmínky;
- zásady ochrany soukromí, retention a právní titul zpracování;
- informace k platebnímu a přístupovému systému;
- cookie a analytics rozhodnutí.

Texty musí schválit provozovatel nebo právník. Aplikace sama právní závěry
nedoplňuje.

## P1: plné QA po připojení služeb

- Spustit kompletní Playwright auth/admin suite s explicitním povolením vzdálených
  mutací podle `tests/e2e/README.md`.
- Ověřit race dvou rezervací stejného slotu.
- Ověřit abandoned Checkout a následné uvolnění slotu.
- Ověřit neúspěšnou, zrušenou a expirovanou platbu.
- Ověřit account ownership a že cizí rezervace ani přístupový kód nejsou čitelné.
- Ověřit Stripe, Nuki, e-mail a WhatsApp retries včetně alertů.

## P2: obsah a měření po spuštění

- Finální Open Graph obrázek.
- Search Console a sitemap.
- Analytics pouze po rozhodnutí o consentu a privacy textu.
- Reálné Core Web Vitals po získání provozu.

## Bezpečné lokální demo

Lokálně lze v `.env.local` nastavit:

```dotenv
DEMO_AUTH_ENABLED="true"
DEMO_AUTH_SECRET="nahodny-retezec-alespon-32-znaku"
BOOKING_PREVIEW_FIXTURE="true"
```

Demo účty jsou určeny jen pro prezentaci mimo produkci. Produkční politika je
vypne i tehdy, kdyby se proměnná omylem nastavila na `true`. Ilustrační kalendář
je jasně označený a v produkci se nezobrazí.

## Co do repozitáře nepatří

- databázová hesla;
- Supabase secret nebo service-role klíče;
- Stripe, Nuki, WhatsApp, Resend, Sentry a cron secrets;
- reálné exporty členů, plateb, logů nebo přístupových kódů;
- lokální `.env.local`.
