# End-to-end testy

Playwright pokrývá veřejný web, měsíční rezervace, lokální demo účty, Supabase
Auth a administrační formuláře. Testy mají tři odlišné režimy.

## 1. Veřejný produkční smoke test

Produkční build bez databáze musí zobrazit transparentní nedostupný stav a nikdy
fiktivní dostupnost.

```bash
npm run build
PORT=3131 npm start
E2E_PORT=3131 npx playwright test tests/e2e/public.spec.ts
```

## 2. Lokální demo bez Supabase

V `.env.local` zapni `DEMO_AUTH_ENABLED`, bezpečný `DEMO_AUTH_SECRET` a volitelně
`BOOKING_PREVIEW_FIXTURE`. Potom spusť dev server a jen demo specifikace:

```bash
npm run dev
E2E_PORT=3000 npx playwright test \
  tests/e2e/admin-demo.spec.ts \
  tests/e2e/customer-demo.spec.ts \
  tests/e2e/public.spec.ts
```

Demo auth je v produkci vždy vypnutý, proto demo specifikace nepatří proti
`npm start` s `NODE_ENV=production`.

## 3. Plná Supabase Auth a admin suite

`global-setup.ts` smí založit testovací účty a zapisovat do vzdáleného projektu
jen při explicitním splnění všech podmínek:

```dotenv
E2E_ALLOW_REMOTE_MUTATIONS="true"
E2E_SUPABASE_PROJECT_REF="potvrzeny-testovaci-ref"
NEXT_PUBLIC_SUPABASE_URL="https://potvrzeny-testovaci-ref.supabase.co"
SUPABASE_SECRET_KEY="serverovy-testovaci-klic"
```

Project ref musí být obsažený v URL. Bez tohoto souhlasu se auth/admin testy
přeskočí a žádný vzdálený účet se nevytvoří.

```bash
PORT=3131 npm start
E2E_PORT=3131 npm run test:e2e
```

Používej samostatný testovací projekt. Nikdy nepovoluj mutační E2E proti
produkční databázi. Auth storage states jsou v `tests/e2e/.auth` a jsou
ignorované Gitem.

## Chromium

Pokud prostředí používá vlastní Chromium, nastav `PW_CHROMIUM_PATH`. Jinak použij
`npx playwright install chromium`.

## Stav checkpointu 2026-07-30

- Lokální demo a veřejný balík: **10 passed, 0 failed**.
- FAQ regresní kontrola ověřuje všech 20 klientských položek a otevření první
  odpovědi.
- Produkční skip navigation stress test: **5/5 passed**.
- Mobilní 44px cíl zpětného odkazu na loginu: **3/3** v nezávislém review.
- Produkční veřejný smoke test bez databáze: **7 passed, 1 expected skipped**.
  Přeskočený scénář vyžaduje živou dostupnost a produkce ji správně
  nenahrazuje fikcí.
- Produkční Node 22 build prošel. Poslední Lighthouse checkpoint z 23. 7. 2026:
  performance 94, accessibility 100, best practices 100 a SEO 100.
- Vzdálené mutační testy nebyly spuštěné, protože nakonfigurovaný Supabase
  projekt nebyl potvrzený jako projekt této aplikace.
- Aktuální blokátory a další kroky jsou v kořenovém `SESSION_HANDOFF.md` a
  `NEEDED.md`.
