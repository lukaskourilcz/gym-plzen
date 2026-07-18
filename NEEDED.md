# NEEDED — manuální nastavení

Seznam všeho, co **musíš nastavit ty** (nebo klient) mimo kód — účty, API klíče,
webhooky a konfigurace externích služeb. Kód je připravený a každou službu si
lazy-inicializuje: dokud klíče nedoplníš, aplikace běží, jen daná funkce je
vypnutá (viz `is<Service>Configured()`).

**Každý řádek níže je jeden úkol = souhrn všech kroků pro danou službu.**
Postupuj podle priority (5 = nejdůležitější, blokuje spuštění; 1 = doladění).

Legenda: ⬜ = udělat, ✅ = hotovo, ⚠️ = pozor.

> **🧪 Klientský náhled (než cokoli z toho nastavíš):** dokud nejsou vyplněné
> `DATABASE_URL` ani Supabase klíče, aplikace se sama přepne do **režimu
> náhledu** — web, rezervace i celá administrace běží **bez přihlášení** nad
> ukázkovými daty (DummyJSON), ukládání je vypnuté a všude svítí lišta
> „Náhled pro klienta“. Jakmile doplníš Supabase (P5 níže), náhled se sám
> vypne a naskočí normální přihlašování. Ruční override: `PREVIEW_MODE=1`
> vynutí náhled (⚠️ nikdy s produkčními daty — administrace je pak veřejná),
> `PREVIEW_MODE=0` ho zakáže.

---

## Priorita 5 — bez tohoto systém nespustíš

### ⬜ [P5] Supabase — databáze, Auth a realtime
Projekt už je založený (`rkmunagymohxtclymacm`, region eu-west-3 / Paříž, EU),
veřejné klíče jsou předvyplněné v `.env.local`. Zbývá:

- **Tajné hodnoty** (do `.env.local` i na Vercel):
  - Heslo k DB → doplň místo `[YOUR-PASSWORD]` do `DATABASE_URL` (pooler, port
    6543) i `DIRECT_URL` (session, port 5432). Reset v *Project Settings →
    Database*. Speciální znaky **percent-enkóduj**.
  - `SUPABASE_SECRET_KEY` (`sb_secret_…`) z *Project Settings → API Keys* —
    server-only, obchází RLS, používá se pro Storage i `set-admin`.
- **Storage**: vytvoř bucket `cms-media` (public), název musí sedět se
  `SUPABASE_STORAGE_BUCKET`.
- **Auth** (*Authentication*):
  - *Providers → Email*: zapni **Email + Password** (pro okamžité přihlášení
    vypni „Confirm email").
  - *URL Configuration*: **Site URL** = produkční doména; **Redirect URLs** =
    `http://localhost:3000/auth/callback` + `https://<doména>/auth/callback`
    (+ Vercel preview, pokud chceš).
  - (volitelné) OAuth Google / Microsoft (`azure`) / Apple — klíče se zadávají
    v Supabase; do Google přidej redirect
    `https://rkmunagymohxtclymacm.supabase.co/auth/v1/callback`.
- **Realtime** (živý kalendář): *Database → Replication → supabase_realtime* →
  přidej tabulku `reservation`.
  - ⚠️ **GDPR:** zapni **RLS** na `reservation` a zakaž `anon`/publishable roli
    číst osobní sloupce (jméno/e-mail/telefon), nebo zveřejni jen
    `starts_at`/`ends_at`/`status` přes pohled. Bez RLS by publishable klíč
    viděl celé řádky.
- **Spuštění**: `npm run db:migrate && npm run db:seed` (vytvoří tabulky +
  exclusion constraint proti překrývání, zapne `btree_gist`), pak se zaregistruj
  na `/login` a povyš se: `npm run set-admin -- tvuj@email.cz`.

✅ Kód hotový: SSR klient + middleware, `/auth/callback`, guardy (`requireAdmin`),
trigger `on_auth_user_created` (migrace `0002`), `RealtimeRefresher` na `/rezervace`.
⚠️ Admin/auth E2E testy neběžely lokálně (chybí lokální GoTrue) — spusť je proti
živému Supabase, viz `tests/e2e/README.md`.

### ⬜ [P5] Vercel — hosting, env proměnné a cron
- Propoj GitHub repo s Vercelem (New Project → `gym-plzen`, Next.js se detekuje).
- *Project Settings → Environment Variables*: nahraj **všechny** proměnné z
  `.env.local` (kromě čistě lokálních) — nezapomeň na `CRON_SECRET`
  (`openssl rand -hex 32`) a `SENTRY_AUTH_TOKEN`.
- Po prvním deployi: nastav produkční doménu, aktualizuj `NEXT_PUBLIC_APP_URL`
  a **rozšiř webhooky/redirecty** o produkční doménu (Supabase Auth URL Config,
  Stripe, Meta, Nuki).

✅ Cron rozvrh je ve `vercel.json` (`/api/cron/watchdog` á 5 min,
`/api/cron/sync-entry-log` á 15 min) — Vercel spustí automaticky, stačí
`CRON_SECRET` (viz výše). Watchdog opakuje selhané kroky a synchronizuje knihu vstupů.

---

## Priorita 4 — potřeba pro placené rezervace a včasný start

### ⬜ [P4] Stripe — platby
Model: **jednorázový vstup 290 Kč** (žádná předplatná). Každý 10. vstup zdarma
řeší kód.

- Založ účet (na klienta/firmu).
- *Developers → API keys*: `STRIPE_SECRET_KEY` (`sk_test_…`/`sk_live_…`) +
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_…`).
- *Developers → Webhooks → Add endpoint*: URL
  `<NEXT_PUBLIC_APP_URL>/api/webhooks/stripe`, události
  `checkout.session.completed` + `invoice.payment_failed` → zkopíruj signing
  secret do `STRIPE_WEBHOOK_SECRET`.
- *Settings → Payment methods*: zapni Apple Pay / Google Pay (na vlastní doméně
  přidej doménu do Apple Pay association).
- *Settings → Payouts*: nastav výplaty na český účet.
- Lokální test: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.

> Cenu vstupu měníš v administraci (*Vstupné a věrnost*), kadenci „každý N-tý
> zdarma" v `src/lib/config/pricing.ts`.

### ⬜ [P4] WhatsApp Business Cloud API — Meta
⚠️ **Začni nejdřív ze všech** — schválení firemního účtu Meta trvá i týdny.

- Firemní účet **Meta Business** + app typu *Business* v *Meta for Developers*
  s produktem **WhatsApp**.
- Env: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID` (API Setup),
  `WHATSAPP_ACCESS_TOKEN` (**trvalý** System User token, ne dočasný),
  `WHATSAPP_APP_SECRET` (Settings → Basic), `WHATSAPP_VERIFY_TOKEN` (vymyslíš,
  zadáš stejný v kódu i Meta).
- Webhook (*WhatsApp → Configuration*): callback
  `<NEXT_PUBLIC_APP_URL>/api/webhooks/whatsapp`, verify token = `WHATSAPP_VERIFY_TOKEN`,
  odebírej pole `messages`.
- **Message template** `access_code` (jazyk `cs`, dva parametry: `{{1}}` = kód,
  `{{2}}` = čas) nech schválit ve *WhatsApp Manager*. Jméno musí sedět s
  `sendTemplateMessage` v `src/lib/services/notifications.ts`.

---

## Priorita 3 — spustit brzy, ale ne blokující

### ⬜ [P3] Resend — e-maily
- Založ účet, přidej a ověř doménu (DNS TXT/MX — bez ověření lze posílat jen
  z testovací adresy).
- Env: `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (např. `Gym Plzeň <noreply@tvujgym.cz>`).

### ⬜ [P3] Nuki — chytrý zámek
- Fyzicky: **Nuki Smart Lock Pro + Keypad** na stabilní Wi-Fi v gymu +
  záložní servisní kód na klávesnici.
- *Nuki Web → API → Web API*: token s právy na auths + čtení logu →
  `NUKI_API_TOKEN`; `NUKI_SMARTLOCK_ID` = ID zámku; `NUKI_WEBHOOK_SECRET` =
  libovolný tajný řetězec.
- Webhook (*Nuki Web → Notifications*): `<NEXT_PUBLIC_APP_URL>/api/webhooks/nuki?secret=<NUKI_WEBHOOK_SECRET>`
  — kniha vstupů se plní hned po odemčení (cron ji navíc synchronizuje).

---

## Priorita 2 — před ostrým provozem

### ⬜ [P2] Doména
Zaregistruj doménu (~500 Kč/rok), nasměruj na Vercel (A/CNAME dle Vercelu),
přidej do Resend (SPF/DKIM) a Stripe (Apple Pay).

### ⬜ [P2] Provozní upozornění (WhatsApp)
`ALERT_WHATSAPP_RECIPIENTS` = telefonní čísla v E.164 oddělená čárkou (např.
`+420777123456,+420777654321`) — dostanou alert při selhání platby/kódu/doručení.
Posílá se přes WhatsApp (viz P4).

---

## Priorita 1 — volitelné / doladění

### ⬜ [P1] SMS — GoSMS (defaultně vypnuté)
Obvykle stačí WhatsApp + e-mail. Když chceš: účet na gosms.cz, OAuth2 client →
`GOSMS_CLIENT_ID`, `GOSMS_CLIENT_SECRET`, `GOSMS_CHANNEL`. SMS chodí jen členům,
kteří si to zapnou v profilu (`notifyBySms`).

### ⬜ [P1] Monitoring — Sentry + UptimeRobot
- Sentry (Next.js): `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`,
  `SENTRY_PROJECT` + `SENTRY_AUTH_TOKEN` na Vercelu (source-mapy při buildu).
- UptimeRobot (zdarma): monitor na hlavní URL + klidně na zdraví Nuki.

### ⬜ [P1] Google Analytics + SEO
- GA4 property → `NEXT_PUBLIC_GA_ID` (`G-XXXXXXX`) na Vercel (skript se doplní do
  `src/app/layout.tsx` přes `next/script`).
- Po nasazení přidej web do **Google Search Console** a odešli sitemapu.

✅ SEO metadata (title/description/OpenGraph) jsou v `src/app/layout.tsx` — jen
doplň finální doménu do `NEXT_PUBLIC_APP_URL`.

---

## Pořadí nasazení (dnešní demo)

Web běží i **bez** databáze (veřejné stránky mají fallback + ukázkový rozvrh),
takže nasaď hned a služby dopojuj postupně:

1. **Deploy na Vercel** s minimem env (`NEXT_PUBLIC_APP_URL`, veřejné Supabase
   klíče; `DATABASE_URL` klidně placeholder). Veřejná stránka, `/rezervace` a
   `/login` fungují.
2. **Připoj Supabase** (P5): heslo + secret key, Auth, migrace + seed, set-admin.
   → přihlášení, rezervace a admin naživo.
3. **Dopojuj** Stripe → Resend → WhatsApp → Nuki (každá služba izolovaná).
4. **Dolaď** Cron, Sentry, GA před ostrým provozem.

Stav rozpracovanosti vidíš v administraci pod **Plán spuštění** (progress bar).

**Kalendář:** používáme **FullCalendar** (MIT) pro admin kalendář
(`/admin/kalendář`); veřejná rezervace používá lehký serverový výběr slotů. Nic
k nastavení — součást buildu.

### MCP servery pro Claude Code (volitelné)
Aby Claude viděl do Supabase / mohl dělat Vercel úkoly, přihlas se **ve svém**
terminálu (OAuth, ne v remote session): `claude` → `/mcp` → vyber
`supabase` / `vercel` → **Authenticate**. Konfigurace je v `.mcp.json`; pro
Supabase případně `claude mcp add --scope project --transport http supabase
"https://mcp.supabase.com/mcp?project_ref=rkmunagymohxtclymacm"`.
