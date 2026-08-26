# Manuální kroky

Kroky, které vyžadují Dashboard, externí konzoli nebo fyzické ověření.
Produkční web běží na `https://www.namastegym.cz`. Při změně domény vždy
aktualizujte také Supabase Auth URL, Stripe webhook a Nuki webhook.

Supabase project ref: **`rkmunagymohxtclymacm`**
Supabase project URL: **`https://rkmunagymohxtclymacm.supabase.co`**

---

## 1. Supabase Auth: Site URL a Redirect URLs

**Kde:**

1. <https://supabase.com/dashboard/project/rkmunagymohxtclymacm/auth/providers>
2. <https://supabase.com/dashboard/project/rkmunagymohxtclymacm/auth/url-configuration>

**Co nastavit:**

Providers → Email:

- Enable Email provider
- Confirm email (produkce)
- Confirm email change
- Secure email change

URL Configuration → Site URL:

- `https://www.namastegym.cz`

URL Configuration → Redirect URLs:

- `http://localhost:3000/**`
- `https://*.vercel.app/**`
- `https://www.namastegym.cz/**`

**Ověření:** `POST /login` s platným e-mailem vrátí `Zkontrolujte e-mail`;
v Auth logu vidíš `user_created` a `magic_link_sent`.

---

## 2. Vercel: Node 22 a env variables

**Node.js Version** — `https://vercel.com/<team>/gym-plzen/settings/general` → **22.x**.
Bez toho Vercel spustí default runtime.

**Environment Variables** — `https://vercel.com/<team>/gym-plzen/settings/environment-variables`.

Přenést z `.env.local` do Vercel Production + Preview:

Public (Sensitive OFF):

- `NEXT_PUBLIC_APP_URL` = `https://www.namastegym.cz`
- `NEXT_PUBLIC_DEFAULT_LOCALE` = `cs`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_OAUTH_PROVIDERS` = `google`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, volitelně `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
- `NEXT_PUBLIC_SENTRY_DSN`

Server-only (Sensitive ON):

- `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_SECRET_KEY`
- `SUPABASE_MANAGEMENT_API_TOKEN` (viz §7)
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (viz §3)
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
- `NUKI_API_TOKEN`, `NUKI_SMARTLOCK_ID`, `NUKI_WEBHOOK_SECRET`
- `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- `GOSMS_CLIENT_ID`, `GOSMS_CLIENT_SECRET`, `GOSMS_CHANNEL`
- `CRON_SECRET` = vygeneruj `openssl rand -hex 32`
- `ALERT_WHATSAPP_RECIPIENTS`, `UPTIMEROBOT_HEARTBEAT_URL`

`DEMO_AUTH_ENABLED` a `BOOKING_PREVIEW_FIXTURE` do produkce **nedávat**.

**Sensitive flag** chrání hodnoty před vyčtením v Dashboardu (screen-share);
runtime i `vercel env pull` je dostanou normálně.

---

## 3. Stripe webhook

**Kde:** <https://dashboard.stripe.com/webhooks> (a Test-mode analog).

- **Endpoint URL:** `https://www.namastegym.cz/api/webhooks/stripe`
- **Události:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
- **Signing secret** (`whsec_...`) → do Vercel Production jako `STRIPE_WEBHOOK_SECRET` (Sensitive).
  Založ analog i pro Test mode, jeho secret nastav do Vercel Preview.

**Ověření:** `stripe listen --forward-to https://www.namastegym.cz/api/webhooks/stripe`
vrátí `200` na `checkout.session.completed`; testovací Checkout dojde na success URL
a rezervace přejde do `confirmed`.

Lokální vývoj a Vercel Preview používají pouze Stripe test klíče. Live secret
patří výhradně do Vercel Production; hosted Checkout nepotřebuje publishable key
v prohlížeči.

---

## 4. WhatsApp / plánovaný Zernio gateway

Aktuální adapter volá přímo Meta Graph API. Zernio je plánovaná REST vrstva nad
Meta WhatsApp Business API. Pod tím jede standardní
WABA, takže Meta setup (ověření podniku, phone verifikace, template approval)
se stejně dělá — Zernio to sdružuje do jednoho dashboardu.

### 4a. WABA a phone number

**Kde:** <https://zernio.com/dashboard> → WhatsApp / Platforms.

1. Propojit Meta účet přes Zernio `/connect/whatsapp` OAuth flow. Bez Meta Business účtu si ho nejdřív založit v <https://business.facebook.com/>.
2. Registrovat WABA (spárovat existující nebo provisioning nové).
3. Verifikovat phone number (SMS/hovor kód od Meta).
4. Zkopírovat výsledné konfigurační hodnoty do prostředí (přesná jména proměnných dá §4c).

### 4b. Template `access_code`

Zernio dashboard → Templates (interně jde na Meta review).

Jméno `access_code`, jazyk `cs`, kategorie `Utility`. Placeholders `{{1}}` (kód)
a `{{2}}` (čas rezervace). Vzor:

```
Vaše rezervace na {{2}} je potvrzena. Vstupní kód: {{1}}
Kód zadejte na klávesnici u dveří v čase rezervace.
```

Odeslat k review. Schválení trvá typicky 1–24 h (může být 1–7 dní).

### 4c. Případný rewrite adapteru (vyžaduje GO)

`src/lib/integrations/whatsapp.ts` pořád volá přímo Meta Graph API. Po dokončení
§4a a §4b řekni **GO** a přepíšu adapter na Zernio (`POST /broadcasts/create-broadcast`),
plus odstraním přímé Meta proměnné `WHATSAPP_ACCESS_TOKEN`,
`WHATSAPP_PHONE_NUMBER_ID` a `WHATSAPP_APP_SECRET`.

**Ověření celého §4:** vytvořím rezervaci → `message_delivery` obsahuje řádek
`channel='whatsapp'`, `status='sent'`, Zernio dashboard ukazuje odchozí broadcast,
klient dostane zprávu s kódem.

---

## 5. Nuki (fyzický zámek) — čeká na nákup

**Kde:** <https://web.nuki.io/>.

Po pořízení zámku doplnit:

- `NUKI_API_TOKEN` a `NUKI_SMARTLOCK_ID` (číselné ID zámku z dashboardu).
- `NUKI_WEBHOOK_SECRET` = `openssl rand -hex 32`; zapsat současně do Nuki webhook UI i do Vercelu (Sensitive, Production + Preview).
- Webhook URL k zaregistrování na Nuki: `https://www.namastegym.cz/api/webhooks/nuki`.

**Fyzicky ověřit:** admin vytvoří rezervaci → API potvrdí vytvořenou Keypad
autorizaci → kód dorazí → zámek otevře → po skončení kód přestane platit →
ruční revokace zafunguje. Zahrnout i retry po simulovaném 204 bez vytvořené
autorizace; aplikace zákazníkovi neposílá PIN, dokud jej zpětné načtení Nuki
nepotvrdí.

---

## 6. Resend — odchozí aplikační e-maily

Doména `namastegym.cz` je v Resend ověřená a Vercel má nastavené
`RESEND_API_KEY` a `RESEND_FROM_EMAIL` pro Production i Preview.

- Sender: `Namasté Private Gym <noreply@namastegym.cz>`
- Šablony jsou v administraci → **E-maily**. Je zde náhled s ukázkovými daty,
  test na zadanou adresu a editace textu pro potvrzení registrace, obnovu
  hesla, potvrzení rezervace, vstupní kód a storno. Všechny používají stejné
  logo a český značkový rámec.

**Ověření:** přihlásit se jako administrátor, zadat vlastní adresu do
„Odeslat test na“, kliknout na „Odeslat testovací e-mail“ a zkontrolovat
Resend Logs. Odeslání se provádí pouze ze serveru; API klíč není v prohlížeči.

---

## 7. Supabase Auth SMTP a šablony z administrace

Custom SMTP přes Resend je nastavený a odkaz pro obnovu hesla byl ověřený.
Aplikace obsahuje `/forgot-password` a `/reset-password`; registrační potvrzení
i resetovací odkaz posílá Supabase Auth.

**Kde:** <https://supabase.com/dashboard/project/rkmunagymohxtclymacm/auth/smtp>

Pokud by se SMTP nastavovalo znovu:

1. Zapnout **Custom SMTP**.
2. Vyplnit:
   - Sender email: `noreply@namastegym.cz`
   - Sender name: `Namasté Private Gym`
   - Host: `smtp.resend.com`
   - Port: `465` (SSL / implicit TLS)
   - Username: `resend`
   - Password: stejný Resend API key jako `RESEND_API_KEY` ve Vercelu
3. Uložit. Při vkládání API klíče jej nikam jinam nekopírovat a nikdy jej
   necommitovat.

### Zpřístupnění šablon v administraci

1. Otevřít <https://supabase.com/dashboard/account/tokens> a vytvořit nový
   **Personal Access Token** s oprávněním upravovat konfiguraci projektu.
2. Ve Vercelu → Project → Settings → Environment Variables přidat
   `SUPABASE_MANAGEMENT_API_TOKEN` pro **Production** i **Preview**.
3. Uložit a spustit nový deployment.
4. V administraci webu → **E-maily** upravit „Potvrzení registrace“ nebo
   „Obnova hesla“ a uložit. Aplikace v bezpečném serverovém volání propíše
   český předmět, text, logo a tlačítko s `{{ .ConfirmationURL }}` do
   hostovaného Supabase Auth. Token se nikdy neposílá do prohlížeče.

**Ověření:**

1. V produkci se zaregistrovat na novou testovací adresu a potvrdit e-mail.
2. Na `/forgot-password` požádat o obnovu a přes e-mail nastavit nové heslo.
3. V administraci odeslat test každé z pěti šablon na vlastní adresu.
4. V Resend Logs ověřit odesílatele `noreply@namastegym.cz`, české texty a
   načtené logo.

---

## 8. Uptime a cron heartbeat monitoring

- UptimeRobot check na `https://www.namastegym.cz/`.
- Cron heartbeat monitor pro `/api/cron/watchdog` (nebo přes `UPTIMEROBOT_HEARTBEAT_URL`,
  který cron pinguje po úspěšném běhu — env je nastavené v `.env.local`).

---

## 9. Poznámky

- `.env.local` a všechny výše uvedené klíče **nikdy** necommituj.
- Po nastavení §1 a §2 proveď v prohlížeči úplný reálný test: registrace, magic-link,
  přihlášení, rezervace, admin sekce vyžaduje admin roli.
- Bezpečnostní hlavičky (CSP, HSTS, frame protection) jsou v kódu; ověř je
  po produkčním deployi přes <https://securityheaders.com/>.
