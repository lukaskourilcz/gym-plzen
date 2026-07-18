# NEEDED — manual setup tasks

Tohle je seznam všeho, co **musíš nastavit ty** (nebo klient) mimo kód —
účty, API klíče, webhooky a konfigurace externích služeb. Kód je připravený a
každou službu si sám lazy-inicializuje: dokud klíče nedoplníš, aplikace běží,
jen daná funkce je vypnutá (viz `is<Service>Configured()`).

Postupuj shora dolů. Vše, co je označené **[blokující]**, je potřeba, aby
základní systém (přihlášení, rezervace, admin) fungoval. Ostatní jsou
integrace, které lze zapínat postupně.

Legenda: ⬜ = udělat, ✅ = hotovo.

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

- ⬜ Založ projekt na <https://supabase.com> (region **EU**, např. Frankfurt —
  kvůli GDPR).
- ⬜ **Project Settings → Database → Connection string**:
  - `DATABASE_URL` = **Transaction pooler** (port `6543`, obsahuje
    `pooler.supabase.com`). Přidej `?pgbouncer=true` pokud ho string nemá.
  - `DIRECT_URL` = **Session/Direct** připojení (port `5432`). Používá se jen
    pro migrace.
- ⬜ **Project Settings → API**:
  - `NEXT_PUBLIC_SUPABASE_URL` = Project URL.
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key.
  - `SUPABASE_SERVICE_ROLE_KEY` = service_role key (**tajné**, jen server).
- ⬜ **Storage → New bucket**: vytvoř bucket `cms-media` (nastav jako *public*,
  pokud chceš obrázky přímo servírovat). Název musí sedět s
  `SUPABASE_STORAGE_BUCKET`.
- ⬜ Spusť migrace: `npm run db:migrate` (vytvoří tabulky + exclusion constraint
  proti překrývání rezervací; ten vyžaduje rozšíření `btree_gist`, které migrace
  zapne sama).
- ⬜ (volitelně) **Realtime**: v Database → Replication zapni realtime pro
  tabulku `reservation`, aby se kalendář na webu aktualizoval okamžitě.

### MCP pro Supabase (volitelné, pro práci s Claude Code)

- ⬜ Chceš-li, aby Claude Code viděl do DB, nastav Supabase MCP server:
  vygeneruj **Personal access token** (Account → Access Tokens) a přidej MCP
  server do své Claude Code konfigurace podle
  <https://supabase.com/docs/guides/getting-started/mcp>. Do repa nic tajného
  nedávej.

---

## 2. Autentizace — Better Auth **[blokující]**

- ⬜ Vygeneruj tajný klíč: `openssl rand -base64 32` → `BETTER_AUTH_SECRET`.
- ⬜ `BETTER_AUTH_URL` a `NEXT_PUBLIC_APP_URL` = URL aplikace
  (`http://localhost:3000` lokálně; produkční doména na Vercelu).
- ✅ Email + heslo funguje rovnou po nasazení DB. OAuth níže je volitelný.

### OAuth přihlášení (Google / Apple / Microsoft) — volitelné

Doplň jen ty, které chceš; tlačítka se zobrazí automaticky podle vyplněných
klíčů. Callback URL pro všechny:
`<NEXT_PUBLIC_APP_URL>/api/auth/callback/<provider>`
(např. `https://tvujgym.cz/api/auth/callback/google`).

- ⬜ **Google** — <https://console.cloud.google.com>: vytvoř projekt →
  *APIs & Services → Credentials → OAuth client ID* (typ *Web application*).
  Přidej redirect URI výše. → `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
  (Nezapomeň nastavit *OAuth consent screen*.)
- ⬜ **Microsoft** — <https://portal.azure.com> → *App registrations* → redirect
  URI výše. → `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`.
- ⬜ **Apple** — <https://developer.apple.com> (placený účet, 99 USD/rok) →
  *Sign in with Apple*, Services ID + klíč. → `APPLE_CLIENT_ID`,
  `APPLE_CLIENT_SECRET`. (Apple je nejpracnější; klidně nech na později.)

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
- ⬜ Po prvním nasazení nastav produkční doménu a aktualizuj `NEXT_PUBLIC_APP_URL`
  / `BETTER_AUTH_URL` + callback URL v Google/Meta/Stripe/Nuki.

### MCP pro Vercel (volitelné)

- ⬜ Pokud chceš Vercel ovládat z Claude Code, nastav Vercel MCP dle
  <https://vercel.com/docs> (token v Account Settings → Tokens).

---

## 12. Doména

- ⬜ Zaregistruj doménu (cca 500 Kč/rok) a nasměruj na Vercel (A/CNAME dle
  instrukcí Vercelu). Přidej ji do Resend (SPF/DKIM) a Stripe (Apple Pay).

---

## Rychlý kontrolní seznam „minimum pro spuštění"

1. ✅ Kód (hotovo)
2. ⬜ Supabase + `npm run db:migrate` + `npm run db:seed`
3. ⬜ `BETTER_AUTH_SECRET`, `NEXT_PUBLIC_APP_URL`
4. ⬜ Stripe (klíče + webhook)
5. ⬜ Resend (klíč + odesílatel)
6. ⬜ Nuki (token + zámek + webhook)
7. ⬜ WhatsApp (účet + token + šablona `access_code`) — *začni nejdřív*
8. ⬜ `CRON_SECRET` na Vercelu
9. ⬜ `set-admin` pro tvůj účet
