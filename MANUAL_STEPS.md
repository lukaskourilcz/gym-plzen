# Manuální kroky

Kroky, které vyžadují Dashboard, externí konzoli nebo fyzické ověření.
Produkční doména se řeší až později; do té doby vše přes
`https://gym-plzen.vercel.app` a preview subdomény.

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
- `https://gym-plzen.vercel.app` (přepsat na vlastní doménu, až bude)

URL Configuration → Redirect URLs:
- `http://localhost:3000/**`
- `https://*.vercel.app/**`
- `https://gym-plzen.vercel.app/**`

**Ověření:** `POST /login` s platným e-mailem vrátí `Zkontrolujte e-mail`;
v Auth logu vidíš `user_created` a `magic_link_sent`.

---

## 2. Vercel: Node 22 a env variables

**Node.js Version** — `https://vercel.com/<team>/gym-plzen/settings/general` → **22.x**.
Bez toho Vercel spustí default runtime.

**Environment Variables** — `https://vercel.com/<team>/gym-plzen/settings/environment-variables`.

Přenést z `.env.local` do Vercel Production + Preview:

Public (Sensitive OFF):
- `NEXT_PUBLIC_APP_URL` = `https://gym-plzen.vercel.app`
- `NEXT_PUBLIC_DEFAULT_LOCALE` = `cs`
- `NEXT_PUBLIC_OAUTH_PROVIDERS` = `google`
- `NEXT_PUBLIC_SENTRY_DSN`

Server-only (Sensitive ON):
- `STRIPE_WEBHOOK_SECRET` (viz §3)
- `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- `GOSMS_CLIENT_ID`, `GOSMS_CLIENT_SECRET`, `GOSMS_CHANNEL`
- `CRON_SECRET` = vygeneruj `openssl rand -hex 32`
- `ALERT_WHATSAPP_RECIPIENTS`
- Nuki webhook secret a Zernio konfigurace až budou (viz §4, §5)

`DEMO_AUTH_ENABLED` a `BOOKING_PREVIEW_FIXTURE` do produkce **nedávat**.

**Sensitive flag** chrání hodnoty před vyčtením v Dashboardu (screen-share);
runtime i `vercel env pull` je dostanou normálně.

---

## 3. Stripe webhook

**Kde:** <https://dashboard.stripe.com/webhooks> (a Test-mode analog).

- **Endpoint URL:** `https://gym-plzen.vercel.app/api/webhooks/stripe`
  (po přechodu na vlastní doménu doplnit nový endpoint na finální doméně a starý deaktivovat)
- **Události:** `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`
- **Signing secret** (`whsec_...`) → do Vercel Production jako `STRIPE_WEBHOOK_SECRET` (Sensitive).
  Založ analog i pro Test mode, jeho secret nastav do Vercel Preview.

**Ověření:** `stripe listen --forward-to https://gym-plzen.vercel.app/api/webhooks/stripe`
vrátí `200` na `checkout.session.completed`; testovací Checkout dojde na success URL
a rezervace přejde do `confirmed`.

`.env.local` drží LIVE Stripe klíče. Doporučené uspořádání:
`.env.local` + Vercel Preview = `sk_test_...` / `pk_test_...`,
Vercel Production = `sk_live_...` / `pk_live_...`.

---

## 4. Zernio (WhatsApp gateway)

Zernio je REST vrstva nad Meta WhatsApp Business API. Pod tím jede standardní
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

### 4c. Rewrite adapteru (vyžaduje GO)

`src/lib/integrations/whatsapp.ts` pořád volá přímo Meta Graph API. Po dokončení
§4a a §4b řekni **GO** a přepíšu adapter na Zernio (`POST /broadcasts/create-broadcast`),
plus odstraním nepoužívané `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`.

**Ověření celého §4:** vytvořím rezervaci → `message_delivery` obsahuje řádek
`channel='whatsapp'`, `status='sent'`, Zernio dashboard ukazuje odchozí broadcast,
klient dostane zprávu s kódem.

---

## 5. Nuki (fyzický zámek) — čeká na nákup

**Kde:** <https://web.nuki.io/>.

Po pořízení zámku doplnit:
- `NUKI_SMARTLOCK_ID` (číselné ID zámku z dashboardu).
- `NUKI_WEBHOOK_SECRET` = `openssl rand -hex 32`; zapsat současně do Nuki webhook UI i do Vercelu (Sensitive, Production + Preview).
- Webhook URL k zaregistrování na Nuki: `https://gym-plzen.vercel.app/api/webhooks/nuki` (po přechodu na vlastní doménu přepsat).

**Fyzicky ověřit:** admin vytvoří rezervaci → kód doručen → zámek otevře →
po skončení kód přestane platit → ruční revocation zafunguje.

---

## 6. Resend — vlastní doména (čeká na doménu)

Po pořízení vlastní domény:

1. Přidat v <https://resend.com/domains>.
2. Vložit SPF/DKIM/DMARC záznamy do registrátora.
3. Kliknout **Verify** — po propagaci DNS se stav změní na `Verified`.
4. Přepsat `RESEND_FROM_EMAIL` v `.env.local` i Vercelu na
   `NAMASTÉ Private Gym <noreply@<vlastní-doména>>`.

**Ověření:** test e-mail dorazí bez SPF failu, Resend logs ukazují `delivered`.

---

## 7. Uptime a cron heartbeat monitoring

- UptimeRobot check na `https://gym-plzen.vercel.app/` (po pořízení domény přepsat).
- Cron heartbeat monitor pro `/api/cron/watchdog` (nebo přes `UPTIMEROBOT_HEARTBEAT_URL`,
  který cron pinguje po úspěšném běhu — env je nastavené v `.env.local`).

---

## 8. Poznámky

- `.env.local` a všechny výše uvedené klíče **nikdy** necommituj.
- Po nastavení §1 a §2 proveď v prohlížeči úplný reálný test: registrace, magic-link,
  přihlášení, rezervace, admin sekce vyžaduje admin roli.
- Bezpečnostní hlavičky (CSP, HSTS, frame protection) jsou v kódu; ověř je
  po produkčním deployi přes <https://securityheaders.com/>.
