# Browser testy

`npm run test:e2e` (stejně jako `npm run test:e2e:local`) spustí produkční build v Node.js 22, lokální náhrady
Supabase Auth, Resend a Comgate a skutečný Chromium. Testy procházejí veřejný
kalendář, obě objednávkové cesty, přihlášení, profil, administraci a změnu i
storno rezervace. Serverové požadavky na cizí domény jsou zablokované. Nejde o
test produkčních služeb.

Použij **novou, zahoditelnou** databázi Postgres na `127.0.0.1`/`localhost`,
jejíž název končí `_test`. V čistém worktree bez `.env*` spusť:

```bash
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/navi_browser_test npm run test:db:setup
TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/navi_browser_test npm run test:e2e
```

Název databáze a port přizpůsob svému izolovanému Postgresu. Runner maže
rezervační **testovací** tabulky a obnovuje výchozí lokální CMS/cenu před každým
průchodem; odmítne vzdálenou DB a `.env`, `.env.local`, `.env.production` a
`.env.production.local`. Kontroluje vlastní značku
serveru, aby si nespletl již běžící aplikaci na portu 3131. Volitelné argumenty
za `test:e2e` vyberou konkrétní Playwright specs. CI připravuje vlastní
novou databázi, spouští stejný runner a nedovolí tiché přeskočení Auth/test DB.

Auth náhrada testuje UI a aplikační autorská oprávnění; kryptografii hostovaného
Supabase Auth, skutečné e-mailové odkazy, RLS a OAuth vyžaduje oddělený testovací
projekt a finální kontrolu vlastníka.

`analytics.spec.ts` a varianty designu lze dodat jako volitelné specs stejnému
runneru. `admin-demo.spec.ts`, `customer-demo.spec.ts` a `loyalty-variant.spec.ts`
testují vývojový demo režim, který je v produkčním buildu záměrně vypnutý. Lze
je spustit přímo přes Playwright v záměrně zapnutém lokálním demo režimu; nejsou
součástí běžného `test:e2e` ani náhradou za autentizované produkční průchody.

Vzdálené mutační E2E mají v `global-setup.ts` samostatnou pojistku: vyžadují
výslovné povolení, přesně shodný host potvrzeného testovacího Supabase projektu
a blokují produkční ref. Pro tento audit nebyly povoleny ani spuštěny.

Playwright ukládá storage state testovacích účtů jen do ignorovaného
`tests/e2e/.auth`. Vlastní Chromium lze zadat přes `PW_CHROMIUM_PATH`; jinak
`npx playwright install chromium`.
