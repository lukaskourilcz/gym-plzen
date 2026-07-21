# NEEDED — manual setup tasks

Tohle je seznam všeho, co **musíš nastavit ty** (nebo klient) mimo kód —
účty, API klíče, webhooky a konfigurace externích služeb. Kód je připravený a
každou službu si sám lazy-inicializuje: dokud klíče nedoplníš, aplikace běží,
jen daná funkce je vypnutá (viz `is<Service>Configured()`).

Postupuj shora dolů. Vše, co je označené **[blokující]**, je potřeba, aby
základní systém (přihlášení, rezervace, admin) fungoval. Ostatní jsou
integrace, které lze zapínat postupně.

---

## Úkoly

Každý úkol má jednořádkové „proč", skóre důležitosti `[imp:N]` (5 = nejvyšší) a
štítek `[owner:me]` (musíš ty — účty, klíče, dashboardy) nebo `[owner:ai]` (zvládne
AI v kódu). Podrobný how-to je v číslovaných sekcích níže. Tento soubor se parsuje
do sekce **Úkoly** v OwnDashboard, kde jde filtrovat podle priority i podle me/ai.

- [ ] **Doplnit tajné Supabase hodnoty a rozjet DB** — heslo do `DATABASE_URL`/`DIRECT_URL`, `SUPABASE_SECRET_KEY`, pak `db:migrate` + `db:seed` + `set-admin`; bez toho neběží přihlášení/rezervace/admin. `[imp:5]` `[owner:me]`
- [ ] **Zapnout Supabase Auth** — Email + Password a správné Site URL + Redirect URLs (`/auth/callback`); jinak se nikdo nepřihlásí. `[imp:5]` `[owner:me]`
- [ ] **Nastavit Vercel hosting** — propojit repo, nahrát všechny env proměnné a po nasazení nastavit produkční doménu + aktualizovat ji ve webhoocích. `[imp:5]` `[owner:me]`
- [ ] **Vytvořit Storage bucket `cms-media`** — sedí s `SUPABASE_STORAGE_BUCKET`, jinak nejde nahrávat média. `[imp:4]` `[owner:me]`
- [ ] **Zapnout Realtime + RLS na `reservation`** — živý kalendář; RLS je nutné kvůli GDPR, aby publishable klíč neviděl osobní údaje. `[imp:4]` `[owner:me]`
- [ ] **Stripe — účet, API klíče, webhook, payouts** — bez toho nejdou placené rezervace (jednorázový vstup 290 Kč). `[imp:4]` `[owner:me]`
- [ ] **WhatsApp Business Cloud API (Meta)** — účet, app, tokeny, webhook a schválená šablona `access_code`; schválení Meta trvá týdny, začni nejdřív. `[imp:4]` `[owner:me]`
- [ ] **Nastavit `CRON_SECRET` na Vercelu** — watchdog opakuje selhané kroky a synchronizuje knihu vstupů; bez něj cron neběží. `[imp:4]` `[owner:me]`
- [ ] **Zaregistrovat doménu a nasměrovat na Vercel** — potřeba pro produkci, SPF/DKIM (Resend) i Apple Pay (Stripe). `[imp:4]` `[owner:me]`
- [ ] **Resend — účet, ověřená doména, API klíč, odesílatel** — bez ověřené domény jdou e-maily jen z testovací adresy. `[imp:3]` `[owner:me]`
- [ ] **Nuki — fyzický zámek + keypad, Web API token, smartlock ID, webhook** — otevírání dveří a kniha vstupů. `[imp:3]` `[owner:me]`
- [ ] **Sentry + UptimeRobot** — DSN, auth token pro source-mapy a monitor dostupnosti. `[imp:3]` `[owner:me]`
- [ ] **GA4 property + `NEXT_PUBLIC_GA_ID` + Search Console** — návštěvnost a indexace; založit property a odeslat sitemapu. `[imp:3]` `[owner:me]`
- [ ] **(volitelně) OAuth Google/Apple/Microsoft** — sociální přihlášení; klíče se zadávají v Supabase. `[imp:2]` `[owner:me]`
- [ ] **Ověřit admin/auth E2E testy proti živému Supabase** — lokálně je nešlo spustit (chybí GoTrue); veřejné testy prošly. `[imp:2]` `[owner:me]`
- [ ] **Nastavit `ALERT_WHATSAPP_RECIPIENTS`** — čísla, která dostanou upozornění při selhání platby/kódu/doručení. `[imp:2]` `[owner:me]`
- [ ] **Napojit GA skript do `src/app/layout.tsx` přes `next/script`** — kód je připravený k doplnění, jakmile bude `NEXT_PUBLIC_GA_ID`. `[imp:2]` `[owner:ai]`
- [ ] **(volitelně) GoSMS** — SMS notifikace; defaultně vypnuté, obvykle stačí WhatsApp + e-mail. `[imp:1]` `[owner:me]`

---

Legenda podrobných sekcí níže: ⬜ = udělat, ✅ = hotovo.

---

## 0. Lokální prostředí

- ⬜ Zkopíruj `.env.example` → `.env.local` a doplňuj do něj hodnoty níže.
- ⬜ `npm install`
- ⬜ Po nastavení databáze: `npm run db:migrate` a `npm run db:seed`.
- ⬜ Zaregistruj si účet přes web (`/login`) a povyš se na admina:
  `npm run set-admin -- tvuj@email.cz`

---

## 1. Databáze — Supabase **[blokující]**

Supabase = Postgres databáze + úložiště souborů (media) + realtime kalendář.

✅ **Projekt je založený**: `rkmunagymohxtclymacm`, region **eu-west-3 (Paříž, EU)**.
Veřejné hodnoty (URL + publishable key) jsou už předvyplněné v `.env.local`.

Zbývá doplnit **dvě tajné hodnoty** (do `.env.local` lokálně a na **Vercelu**):

- ⬜ **Heslo k databázi** → do `DATABASE_URL` i `DIRECT_URL` místo
  `[YOUR-PASSWORD]`. Najdeš/resetuješ v **Project Settings → Database →
  Database password**. Přesné stringy (region eu-west-3) jsou v `.env.local`:
  - `DATABASE_URL` = transaction pooler, port **6543**
  - `DIRECT_URL` = session pooler, port **5432** (migrace)
  - Má-li heslo speciální znaky, **percent-enkóduj** je.
- ⬜ **Secret key** (`sb_secret_…`) → `SUPABASE_SECRET_KEY` (jen server, obchází
  RLS, používá se pro nahrávání do Storage). Vytvoříš v **Project Settings →
  API Keys**. V dashboardu ti ho ukázalo zamaskovaně — zkopíruj celý.
- ✅ `NEXT_PUBLIC_SUPABASE_URL` a `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` už máš
  (veřejné, bezpečné do prohlížeče).
- ⬜ **Storage → New bucket**: vytvoř bucket `cms-media` (public, pokud chceš
  obrázky servírovat přímo). Název musí sedět s `SUPABASE_STORAGE_BUCKET`.
- ⬜ Spusť migrace + seed (po doplnění hesla):
  `npm run db:migrate && npm run db:seed`
  (vytvoří tabulky + exclusion constraint proti překrývání rezervací; vyžaduje
  rozšíření `btree_gist`, které migrace zapne sama).
- ⬜ Založ si účet přes `/login` a povyš se na admina:
  `npm run set-admin -- tvuj@email.cz`

### Realtime „živý kalendář" (aby zabraný slot zmizel všem hned)

Kód už je hotový (`RealtimeRefresher` na stránce `/rezervace`) — chybí jen
zapnout Realtime v Supabase:

- ⬜ **Database → Replication → `supabase_realtime`**: přidej tabulku
  `reservation`.
- ⚠️ **GDPR — důležité:** Realtime posílá změny řádků. Tabulka `reservation`
  obsahuje osobní údaje (jméno, e-mail, telefon). Náš klient payload ignoruje a
  jen znovu načte dostupnost ze serveru, **ale** aby data neputovala do
  prohlížeče vůbec, zapni **RLS** na `reservation` a přidej politiku, která
  `anon`/publishable roli **nedovolí** číst osobní sloupce (nebo zveřejni jen
  `starts_at`/`ends_at`/`status` přes pohled). Bez RLS by publishable klíč viděl
  celé řádky.

### MCP pro Supabase (volitelné, pro práci s Claude Code)

- ⬜ Chceš-li, aby Claude Code viděl do DB, přidej Supabase MCP server (spusť ve
  **svém** terminálu, ne v IDE — kvůli OAuth přihlášení):
  ```
  claude mcp add --scope project --transport http supabase \
    "https://mcp.supabase.com/mcp?project_ref=rkmunagymohxtclymacm"
  ```
  Pak `claude` → `/mcp` → vyber `supabase` → **Authenticate**.

---

## 2. Autentizace — Supabase Auth **[blokující]**

Přihlašování teď řeší **Supabase Auth** (uživatelé v `auth.users`, náš profil v
`public.profiles`, role `admin`/`member`). Vše se nastavuje **v Supabase
dashboardu**, žádné auth secrety v kódu nejsou.

- ✅ Kód hotový: SSR klient + middleware (obnova session), `/auth/callback`
  (OAuth), guardy (`requireAdmin` atd.), trigger `on_auth_user_created` zakládá
  profil při registraci (běží v migraci `0002`).
- ⬜ **Supabase → Authentication → Sign In / Providers → Email**: zapni
  **Email + Password**. Pro okamžité přihlášení po registraci vypni
  *"Confirm email"* (nebo ho nech zapnuté a počítej s potvrzovacím e-mailem —
  náš formulář to zvládne).
- ⬜ **Authentication → URL Configuration**:
  - **Site URL** = produkční doména (např. `https://tvujgym.cz`).
  - **Redirect URLs** = přidej `http://localhost:3000/auth/callback` a
    `https://<doména>/auth/callback` (a Vercel preview URL, pokud chceš).
- ⬜ **OAuth (volitelné)** — zapni v **Authentication → Providers**:
  - **Google** — client ID/secret z Google Cloud; do Google přidej redirect
    `https://rkmunagymohxtclymacm.supabase.co/auth/v1/callback`.
  - **Microsoft (Azure)** — v našem UI je tlačítko „přes Microsoft" = provider
    `azure`. Nastav v Azure + Supabase.
  - **Apple** — Sign in with Apple (placený Apple Developer účet).
  - Klíče se zadávají **v Supabase**, ne u nás.
- ⬜ Po registraci svého účtu na `/login` se povyš na admina:
  `npm run set-admin -- tvuj@email.cz` (potřebuje `SUPABASE_SECRET_KEY`).
- ⚠️ **Ověření E2E:** admin/auth Playwright testy jsem lokálně nemohl spustit
  (chybí lokální Supabase/GoTrue). Rozběhnou se proti živému Supabase — viz
  `tests/e2e/README.md` (nastav `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY`
  a spusť `npm run test:e2e`). Veřejné testy prošly.

---

## 3. Platby — Stripe **[blokující pro placené rezervace]**

Model: **jednorázový vstup 290 Kč**, žádná měsíční předplatná. Každý 10. vstup
zdarma (řeší kód, ne Stripe).

- ⬜ Založ účet na <https://stripe.com> (na klienta / firmu).
- ⬜ **Developers → API keys**: `STRIPE_SECRET_KEY`
  (`sk_test_…` pro test, `sk_live_…` ostře),
  `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_…`).
- ⬜ **Developers → Webhooks → Add endpoint**:
  - URL: `<NEXT_PUBLIC_APP_URL>/api/webhooks/stripe`
  - Události: `checkout.session.completed`, `invoice.payment_failed`
    (a `customer.subscription.*`, pokud bys v budoucnu chtěl předplatná).
  - Zkopíruj *Signing secret* → `STRIPE_WEBHOOK_SECRET`.
- ⬜ **Apple Pay / Google Pay**: v *Settings → Payment methods* je zapni; při
  hostování na vlastní doméně přidej doménu do *Apple Pay domain association*.
- ⬜ **Payouts**: v *Settings → Payouts* nastav frekvenci výplat na český účet.
- ⬜ Lokální testování webhooku: `stripe listen --forward-to
  localhost:3000/api/webhooks/stripe` (Stripe CLI).

> Cenu vstupu měníš v administraci (**Vstupné a věrnost**), kadenci „každý N-tý
> zdarma" v `src/lib/config/pricing.ts`.

---

## 4. E-maily — Resend

- ⬜ Založ účet na <https://resend.com>.
- ⬜ **Domains**: přidej a ověř doménu (DNS TXT/MX záznamy). Bez ověřené domény
  lze posílat jen z testovací adresy.
- ⬜ **API Keys**: `RESEND_API_KEY`.
- ⬜ `RESEND_FROM_EMAIL` = odesílatel, např. `Gym Plzeň <noreply@tvujgym.cz>`.
- ⬜ (volitelné) Webhook pro stav doručení:
  `<NEXT_PUBLIC_APP_URL>/api/webhooks/whatsapp` je pro WhatsApp; pro Resend
  delivery-status by se přidal analogický route handler — zatím není potřeba.

---

## 5. WhatsApp Business Cloud API — Meta

⚠️ **Začni brzy** — schválení firemního účtu Meta může trvat týdny.

- ⬜ Firemní účet **Meta Business** (<https://business.facebook.com>) na klienta.
- ⬜ V **Meta for Developers** (<https://developers.facebook.com>) vytvoř app
  typu *Business* a přidej produkt **WhatsApp**.
- ⬜ `WHATSAPP_PHONE_NUMBER_ID` a `WHATSAPP_BUSINESS_ACCOUNT_ID` z WhatsApp →
  API Setup.
- ⬜ `WHATSAPP_ACCESS_TOKEN` — vygeneruj **trvalý** token (System User token),
  ne dočasný.
- ⬜ `WHATSAPP_APP_SECRET` = App secret (Settings → Basic) — ověřuje podpis
  webhooku.
- ⬜ `WHATSAPP_VERIFY_TOKEN` = libovolný řetězec, který si vymyslíš a zadáš
  stejný na obou místech (kód i Meta).
- ⬜ **Webhook** (WhatsApp → Configuration):
  - Callback URL: `<NEXT_PUBLIC_APP_URL>/api/webhooks/whatsapp`
  - Verify token: hodnota `WHATSAPP_VERIFY_TOKEN`
  - Odebírej pole: `messages`.
- ⬜ **Message template** pro vstupní kód: v *WhatsApp Manager → Message
  templates* vytvoř a nech schválit šablonu jménem **`access_code`** (jazyk
  `cs`) se dvěma parametry v těle: `{{1}}` = kód, `{{2}}` = čas rezervace.
  (Jméno šablony musí sedět s `sendTemplateMessage` v
  `src/lib/services/notifications.ts`.)

---

## 6. Chytrý zámek — Nuki Web API

- ⬜ Fyzicky: **Nuki Smart Lock Pro + Nuki Keypad**, připojené na stabilní
  Wi-Fi v gymu.
- ⬜ Ve **Nuki Web** (<https://web.nuki.io>) → *API* → *Web API* vygeneruj token
  s právy na správu oprávnění (auths) a čtení logu → `NUKI_API_TOKEN`.
- ⬜ `NUKI_SMARTLOCK_ID` = ID zámku (z Nuki Web, u zařízení).
- ⬜ `NUKI_WEBHOOK_SECRET` = libovolný tajný řetězec; nastav ho jako `?secret=…`
  parametr, resp. `x-nuki-secret` hlavičku, ve Nuki webhooku.
- ⬜ **Webhook** (Nuki Web → Notifications/Webhook): směřuj na
  `<NEXT_PUBLIC_APP_URL>/api/webhooks/nuki?secret=<NUKI_WEBHOOK_SECRET>`, aby se
  „kniha vstupů" plnila hned po odemčení. (Cron ji navíc synchronizuje periodicky.)
- ⬜ Nastav si fyzicky i **záložní servisní kód** na klávesnici pro nouzové situace.

---

## 7. SMS — GoSMS (volitelné, defaultně vypnuté)

Dle plánu obvykle stačí WhatsApp + e-mail. SMS lze kdykoli zapnout.

- ⬜ Účet na <https://www.gosms.cz>, OAuth2 client → `GOSMS_CLIENT_ID`,
  `GOSMS_CLIENT_SECRET`.
- ⬜ `GOSMS_CHANNEL` = ID kanálu, ze kterého se posílá.
- ℹ️ SMS se posílá jen členům, kteří si to zapnou v profilu (`notifyBySms`).

---

## 8. Monitoring — Sentry (+ UptimeRobot)

- ⬜ Projekt na <https://sentry.io> (Next.js). → `SENTRY_DSN`,
  `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`.
- ⬜ Pro nahrávání source-map při buildu na Vercelu: **auth token**
  (Settings → Auth Tokens) → env var `SENTRY_AUTH_TOKEN` na Vercelu.
- ⬜ **UptimeRobot** (<https://uptimerobot.com>, zdarma): monitor na hlavní URL
  a klidně na zdraví Nuki. Kritické výpadky řeší i vlastní alerting (viz níže).

---

## 9. Provozní upozornění (WhatsApp skupina)

- ⬜ `ALERT_WHATSAPP_RECIPIENTS` = telefonní čísla (E.164, oddělená čárkou),
  která dostanou upozornění při selhání (platba/kód/doručení). Např.
  `+420777123456,+420777654321`. Posílá se přes WhatsApp (bod 5).

---

## 10. Cron / plánované úlohy **[blokující pro spolehlivost]**

Watchdog opakuje selhané kroky a synchronizuje knihu vstupů.

- ⬜ `CRON_SECRET` = `openssl rand -hex 32`. Na Vercelu nastav stejnou hodnotu
  jako env var — Vercel Cron ji posílá v `Authorization: Bearer …`.
- ✅ Rozvrh je v `vercel.json` (`/api/cron/watchdog` každých 5 min,
  `/api/cron/sync-entry-log` každých 15 min). Vercel je spustí automaticky po
  nasazení.

---

## 11. Hosting — Vercel

- ⬜ Propoj GitHub repo s <https://vercel.com>.
- ⬜ **Project Settings → Environment Variables**: nahraj VŠECHNY proměnné
  z `.env.local` (kromě čistě lokálních). Nezapomeň na `CRON_SECRET` a
  `SENTRY_AUTH_TOKEN`.
- ⬜ Po prvním nasazení nastav produkční doménu, aktualizuj `NEXT_PUBLIC_APP_URL`
  a doplň doménu do **Supabase → Authentication → URL Configuration** (Site URL +
  Redirect URLs `.../auth/callback`) a do Stripe/Meta/Nuki webhooků.

### MCP pro Vercel (aby Claude mohl dělat Vercel úkoly)

Přidal jsem konfiguraci Vercel MCP do `.mcp.json`. Aby fungovala, je potřeba se
**přihlásit** (OAuth) — to musíš udělat ty ve svém terminálu:

```
claude   # v projektu
/mcp     # vyber "vercel" → Authenticate
```

Alternativně příkazem, který jsi poslal:
`npx add-mcp https://mcp.vercel.com`. Po přihlášení pak zvládnu nastavovat env
proměnné, sledovat deploye a logy z Vercelu. (V této remote session se MCP
nepřihlásí — proto to spusť u sebe.)

---

## 12. Doména

- ⬜ Zaregistruj doménu (cca 500 Kč/rok) a nasměruj na Vercel (A/CNAME dle
  instrukcí Vercelu). Přidej ji do Resend (SPF/DKIM) a Stripe (Apple Pay).

---

## 13. Google Analytics + SEO

- ⬜ Založ **GA4** property (<https://analytics.google.com>), zkopíruj
  Measurement ID (`G-XXXXXXX`) a přidej ho na Vercel jako
  `NEXT_PUBLIC_GA_ID`. (Skript GA lze přidat do `src/app/layout.tsx` přes
  `next/script` — připraveno k doplnění.)
- ✅ SEO metadata (title/description/OpenGraph) jsou nastavená v
  `src/app/layout.tsx`; doplň finální doménu do `NEXT_PUBLIC_APP_URL`.
- ⬜ Po nasazení přidej web do **Google Search Console** a odešli sitemapu.

---

## 🚀 Runbook: nasazení na Vercel (dnešní demo)

Web běží i **bez** databáze (veřejné stránky mají fallback obsah a ukázkový
rozvrh), takže ho můžeš nasadit hned a služby dopojit postupně.

1. **Import repa do Vercelu** (New Project → vyber `gym-plzen`). Framework se
   detekuje automaticky (Next.js).
2. **Env proměnné (minimum pro build a běh):**
   - `NEXT_PUBLIC_APP_URL` = `https://<tvuj-projekt>.vercel.app`
   - `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (už máš)
   - `DATABASE_URL` = může být zatím placeholder; veřejný web poběží, admin a
     rezervace/přihlášení se rozjedou po připojení Supabase (krok 1 nahoře).
3. **Deploy.** Veřejná stránka, `/rezervace` (ukázkový rozvrh) a `/login` fungují.
4. **Připoj Supabase** (sekce 1 + 2): doplň heslo do `DATABASE_URL`/`DIRECT_URL`,
   `SUPABASE_SECRET_KEY`, zapni **Supabase Auth** (Email + redirect URLs), spusť
   `npm run db:migrate` a `npm run db:seed`, pak `npm run set-admin -- tvuj@email.cz`.
   Přihlášení, rezervace i administrace naživo.
5. **Postupně** dopojuj Stripe → Resend → WhatsApp → Nuki (sekce 3–6). Každá
   služba je izolovaná; dokud chybí klíče, daná část je jen vypnutá.
6. **Cron** (`CRON_SECRET`) a **Sentry/GA** dolaď před ostrým provozem.

Stav rozpracovanosti sleduješ v administraci pod **Plán spuštění** (progress bar).

### Kalendářní knihovna

Používáme **FullCalendar** (licence MIT) pro administrační kalendář
(`/admin/kalendář`) — týdenní pohled, hodinové sloty 05:00–21:00, bloky pro
úklid tažením myší. Veřejná rezervace používá lehký serverový výběr slotů
(rychlé, SEO-friendly). Nic k nastavení — je součástí buildu.

---

## Rychlý kontrolní seznam „minimum pro spuštění"

1. ✅ Kód (hotovo)
2. ⬜ Supabase: **heslo DB** → `DATABASE_URL`/`DIRECT_URL`, **secret key** →
   `SUPABASE_SECRET_KEY`, pak `npm run db:migrate` + `npm run db:seed`
3. ⬜ Supabase Auth: zapni **Email + Password** a **Redirect URLs** (`/auth/callback`)
4. ⬜ `set-admin` pro tvůj účet (`npm run set-admin -- tvuj@email.cz`)
5. ⬜ (volitelně) OAuth Google/Apple/Microsoft v Supabase dashboardu
6. ⬜ Realtime: přidej tabulku `reservation` + RLS (sekce 1)
7. ⬜ Stripe (klíče + webhook)
8. ⬜ Resend (klíč + odesílatel)
9. ⬜ Nuki (token + zámek + webhook)
10. ⬜ WhatsApp (účet + token + šablona `access_code`) — *začni nejdřív*
11. ⬜ `CRON_SECRET` na Vercelu + env proměnné
12. ⬜ Vercel MCP: `/mcp` → Authenticate (abych mohl dělat Vercel úkoly)
