# Co je potřeba dokončit mimo repozitář

Aktualizováno 7. 9. 2026. Detail auditu, výsledky a přejímací scénáře:
[docs/PRODUCTION_CHECKLIST.md](./docs/PRODUCTION_CHECKLIST.md).
Postupy: [MANUAL_STEPS.md](./MANUAL_STEPS.md).

`[imp:N]` = priorita 1–5; vlastník `me` = provozovatel/vývojář s přístupy,
`ai` = navazující implementace nebo ověření po dodání prostředí.
Produkční projekt Supabase: `rkmunagymohxtclymacm`.

## Před otevřením objednávek

- [ ] **Ověřit produkční env ve Vercelu** — audit nedostal dostupný tým/projekt a klíče neověřil. Spustit `npm run check:production-env` v bezpečném prostředí a potom skutečně ověřit integrace. Node 22, správná HTTPS doména, shoda Supabase projektu. `[imp:5]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Stripe live a webhook** — správný live secret a podepsaný endpoint `https://www.navigym.cz/api/webhooks/stripe`; testovací prostředí musí mít vlastní Stripe test a DB. Projít nákup, expiraci, duplicitu a refundaci. `[imp:5]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Nuki fyzický zámek** — doplnit/ověřit token, ID zámku a webhook secret; fyzicky vyzkoušet vytvoření, časové okno, přesun, expiraci, odvolání a výpadek. Historická poznámka o čekání na nákup nebyla znovu potvrzena. `[imp:5]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **E-maily a Auth SMTP** — ověřit doménu NAVI v Resendu, sender, doručení všech pěti šablon, PIN a ICS přílohu. `SUPABASE_MANAGEMENT_API_TOKEN` je nutný pro synchronizaci registrace/resetu z administrace. `[imp:5]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Vizuální a kompletní E2E přejímka** — browser preview zde nenaběhlo. Projít mobil/tablet/desktop a scénáře z checklistu na izolovaných testovacích službách. Lokální databázové testy nenahrazují zámek ani browser. `[imp:5]` `[owner:ai]` `[time:2h]` `[kind:deploy]`
- [ ] **Cron a provozní alerty** — ověřit watchdog po 5 min, entry log po 15 min, `CRON_SECRET`, podporu tarifu/300s timeoutu a skutečné doručení kritické výstrahy. Heartbeat nesmí být jen neověřená env hodnota. `[imp:5]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Právní a refundové podmínky** — klient musí potvrdit rozdíly kapacity 4/6/5 osob, telefonu a storna/přesunu; doménu, kontakty a účinnost textů. Dodané VOP neměnit bez souhlasu, včetně překlepů. Storno v aplikaci automaticky nevrací platbu ve Stripe. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:legal]`
- [ ] **Předat skutečnou administraci** — databáze má 3 skutečné admin profily; ověřit přihlášení a zaškolit správkyně. Následně odstranit dvě rezervované demo identity v Supabase Auth. `[imp:5]` `[owner:me]` `[time:45m]` `[kind:setup]`
- [ ] **Migrace, staging a záloha** — schéma obsahuje 0006–0010, historie Supabase nikoli. Bezpečně porovnat a sladit historii, ověřit obnovu/staging. Interní migrační tabulku neupravovat naslepo. `[imp:4]` `[owner:ai]` `[time:30m]` `[kind:deploy]`
- [ ] **Ochrana hesel** — Supabase Security Advisor hlásí vypnutou ochranu proti uniklým heslům. Zapnout a otestovat registraci i změnu hesla. `[imp:4]` `[owner:me]` `[time:10m]` `[kind:setup]`
- [ ] **Sdílené omezení požadavků** — ověřit WAF/rate limits pro login a objednávky. Aplikační limit je jen v paměti jedné instance. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Fakturační údaje a doklady** — provozovatel musí potvrdit předvyplněné údaje, DPH, zapnutí `billing.send_documents` a doklad z určené platby. Nevymýšlet DIČ ani účetní údaje. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Aktivní voucher** — potvrdit zamýšlenou pevnou slevu bez časového omezení. Audit existující voucher nedeaktivoval. `[imp:3]` `[owner:me]` `[time:5m]` `[kind:decision]`

- [ ] **Vývojové závislosti** — úplný npm audit má 4 moderate nálezy v drizzle-kit/esbuild; produkční závislosti jsou bez nálezu. Naplánovat kompatibilní aktualizaci migračních nástrojů bez vynuceného major upgradu. `[imp:2]` `[owner:ai]` `[time:30m]` `[kind:deploy]`

## Obsah a navazující nastavení

- [ ] **Doména a kontakty** — ověřit doručitelnost `info@navigym.cz`, callbacky na `www.navigym.cz`, přesměrování staré domény a Search Console. Historický DNS stav není aktuálním ověřením. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Google mapa a Safari login** — ověřit referrery Maps klíče pro novou doménu, platný Map ID a Google přihlášení v Safari. Bez obou mapových hodnot funguje standardní embed. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Soukromí a volitelné služby** — potvrdit povinnosti společných správců, kamerovou retenci a správce, retenci GA4 a aktivní Sentry/GoSMS. GA4/Meta nastavit jen při požadovaném měření se souhlasem. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:legal]`
- [ ] **WhatsApp poskytovatel** — kód používá Meta Graph API a schválenou šablonu `access_code`. Historicky zvažované Zernio není zapojené; případný přechod je samostatná změna. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:decision]`
- [ ] **Logo a skutečné fotografie** — získat vektor loga a skutečné fotky zón. Ilustrační obrázky už existují a lze je nahradit v administraci. `[imp:3]` `[owner:me]` `[time:2h]` `[kind:content]`
- [ ] **Zvolit výchozí vzhled** — posoudit varianty přes `/dev`; poté lze odstranit přepínač a druhou variantu. Obě jsou nyní funkční součástí produktu, ne dead code. `[imp:3]` `[owner:me]` `[time:20m]` `[kind:decision]`
- [ ] **Drobné obsahové podklady** — potvrdit hero text a případnou značku české kosmetiky. Do té doby ponechat současné pravdivé znění. `[imp:2]` `[owner:me]` `[time:10m]` `[kind:content]`

Říjnová cena 199 Kč a horizont 130 dní jsou v živé databázi již nastavené;
není třeba znovu spouštět historický nastavovací skript. Standardní cena je 289 Kč.

## Bezpečné zacházení s konfigurací

Tajné klíče, `.env.local`, osobní exporty a plaintext vstupních kódů necommitovat.
Demo je pouze lokální; produkční kód ho vypíná a rezervované identity odmítá.
Návody ani výstup preflight kontroly nemají obsahovat hodnoty tajných klíčů.
