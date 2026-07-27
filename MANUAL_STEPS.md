# Manuální kroky (Supabase + Vercel bootstrap)

Vše, co jde přes MCP nebo CLI, už proběhlo. Tento seznam obsahuje kroky, které
objektivně vyžadují Dashboard, externí konzoli nebo fyzické ověření. Nahoře
akční úkoly, dole úkoly blokované klientovým nákupem (doména / zámek).
Vlastní produkční doména se řeší **až později**; do té doby jede vše přes
`https://gym-plzen.vercel.app` a preview subdomény.

Supabase project ref (neměnný): **`rkmunagymohxtclymacm`**
Supabase project URL: **`https://rkmunagymohxtclymacm.supabase.co`**

---

## 2. Zapnout e-mail auth a nastavit URL v Supabase Auth ⏱️ blokuje přihlášení

*Proč to nejde automatizovat:* Supabase MCP neposkytuje tool na úpravu Auth
config (Site URL, Redirect URLs, email confirm flag). Management API vyžaduje
osobní access token, který v MCP není.

**Kde:**

1. <https://supabase.com/dashboard/project/rkmunagymohxtclymacm/auth/providers>
2. <https://supabase.com/dashboard/project/rkmunagymohxtclymacm/auth/url-configuration>

**Co přesně nastavit:**

Providers → **Email**:
- ✅ Enable Email provider
- ✅ Confirm email (produkce)
- Confirm email change: ✅
- Secure email change: ✅

URL Configuration → **Site URL**:
- `https://gym-plzen.vercel.app` (Vercel produkční URL). Po pořízení vlastní
  domény přepsat.

URL Configuration → **Redirect URLs** (seznam wildcard patternů):
- `http://localhost:3000/**`
- `https://*.vercel.app/**` (pro preview branches)
- `https://gym-plzen.vercel.app/**`

**Jak poznám, že to vyšlo:** Přihlášení e-mailem lokálně: `POST /login` s
platným e-mailem vrátí `Zkontrolujte e-mail`; v Auth logu vidíš
`user_created` a `magic_link_sent`.

**Čas:** 5 min.

---

## 3. Google OAuth — dokončit `NEXT_PUBLIC_OAUTH_PROVIDERS`

**Stav:** Google Cloud Console OAuth client vytvořený ✅. Supabase Google
provider aktivovaný ✅. State-parameter troubleshooting vyřešený ✅.

Zbývá jediné: nastav v `.env.local` a ve Vercelu:

```
NEXT_PUBLIC_OAUTH_PROVIDERS="google"
```

Neověřený provider necháme prázdný, jinak se ve formuláři objeví nefunkční
tlačítko.

**Jak poznám, že to vyšlo:** login formulář zobrazí tlačítko "Sign in with
Google" a proklikne kompletní OAuth flow do `auth.users`.

**Čas:** 2 min.

---

## 4. Vercel — env a Node 22

*Proč to nejde automatizovat:* Vercel MCP má jen `deploy_to_vercel` (nový
projekt bez git), `list_projects`, `get_project`, `list_deployments`,
`get_web_analytics`. Nemá tool na úpravu env variables, Node version, git
integration, ani Analytics toggle.

### 4b. General → Node.js Version

**Kde:** `https://vercel.com/<team>/gym-plzen/settings/general`

**Co vložit:** Node.js Version = **22.x**. Bez `nodejs22.x` Vercel spustí
default, který se s balíčky v `package.json` může rozejít.

**Jak poznám, že to vyšlo:** v Deployment → Build Logs vidíš
`Node.js version: 22.x`.

### 4c. Environment Variables — částečně hotovo, zbytek TODO

**Kde:** `https://vercel.com/<team>/gym-plzen/settings/environment-variables`

**Už nastavené (Production + Preview):**

- Supabase: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`,
  `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_JWKS_URL`,
  `SUPABASE_STORAGE_BUCKET` ✅
- Stripe: `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` ✅
- Resend: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` ✅
- Nuki: `NUKI_API_TOKEN` ✅
- Zernio: `ZERNIO_API_KEY` ✅

**Ke Sensitive flagu:** není to problém. Chrání to hodnoty před vyčtením z
Dashboardu (screen-share, kolegová obrazovka). Runtime a build funguje
normálně, `vercel env pull` v CLI hodnotu stále dostane. Jediná nepohodlnost:
nemůžeš okem porovnat, jestli `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` a
`SUPABASE_PUBLISHABLE_KEY` mají identickou hodnotu — pokud jsi je vkládal
ze stejné schránky, jsi v pohodě.

**Ještě chybí** (přidej postupně jak služby zprovozníš):

Public (Production + Preview + Development):
- `NEXT_PUBLIC_APP_URL` = `https://gym-plzen.vercel.app` (po přechodu na vlastní
  doménu přepsat)
- `NEXT_PUBLIC_DEFAULT_LOCALE` = `cs`
- `NEXT_PUBLIC_OAUTH_PROVIDERS` = `google` (viz krok 3)

Server-only tajemství (Production + Preview, **Sensitive** flag):
- `STRIPE_WEBHOOK_SECRET` (viz krok 5)
- Zernio phone/template config, jakmile bude potřeba na runtime
  (viz krok 6 — do doby, než se přepíše `whatsapp.ts` adapter, WhatsApp větev
  v aplikaci nefunguje ani s klíčem)
- `GOSMS_CLIENT_ID`, `GOSMS_CLIENT_SECRET`, `GOSMS_CHANNEL` (viz krok 7)
- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
  `SENTRY_AUTH_TOKEN` (viz krok 8)
- `CRON_SECRET` = vygeneruj `openssl rand -hex 32`
- `ALERT_WHATSAPP_RECIPIENTS`

`DEMO_AUTH_ENABLED` a `BOOKING_PREVIEW_FIXTURE` do produkce **nedávej**
(produkční politika je vypne, ale nezavádět je ani jako `false` — čistší).

---

## 5. Stripe ⏱️ latence (KYC verifikace účtu)

*Proč to nejde automatizovat:* Stripe MCP není k dispozici; navíc zřízení
Business účtu vyžaduje reálné doklady majitele.

**Stav (kontrola 2026-07-27):**

- `STRIPE_SECRET_KEY` (`sk_live_...`) a `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
  (`pk_live_...`) jsou v `.env.local` i ve Vercelu ✅
- `STRIPE_WEBHOOK_SECRET` — **ještě chybí**, viz níže

**⚠️ V `.env.local` máš LIVE klíče.** Doporučené uspořádání: `.env.local` a
Vercel Preview scope drží `sk_test_...` / `pk_test_...`, Vercel Production drží
`sk_live_...` / `pk_live_...`. Přepnutí do Test módu:
Stripe Dashboard → toggle Test mode → Developers → API keys.

### 5a. Webhook endpoint

**Kde:** <https://dashboard.stripe.com/webhooks> (a Test-mode analog)

**Co udělat:**

- **Endpoint URL:** `https://gym-plzen.vercel.app/api/webhooks/stripe`
  (po přechodu na vlastní doménu doplnit nový endpoint na finální doméně
  a starý deaktivovat)
- **Události:** `checkout.session.completed`,
  `checkout.session.async_payment_succeeded`,
  `checkout.session.async_payment_failed`, `checkout.session.expired`
- Zkopíruj **Signing secret** (`whsec_...`) → do Vercel Production jako
  `STRIPE_WEBHOOK_SECRET` (Sensitive). Založ zvlášť i pro Test mode
  a jeho secret nastav ve Vercel Preview.

**Jak poznám, že to vyšlo:** `stripe listen --forward-to
https://gym-plzen.vercel.app/api/webhooks/stripe` ukáže `200` na
`checkout.session.completed`; testovací Checkout redirectne na success URL
a rezervace přejde do `confirmed`.

**Čas:** 15 min.

---

## 6. Zernio (WhatsApp gateway, nahrazuje přímou integraci s Meta) ⏱️ latence (WABA a template schvalování)

**Kontext:** Zernio je REST vrstva nad **Meta WhatsApp Business API**
(zdroj: <https://docs.zernio.com>). Poskytuje unified inbox, template
management a broadcast endpoint. Pod tím pořád jede standardní WABA
(WhatsApp Business Account), takže Meta setup (ověření podniku, phone number
verification, template approval) se nakonec dělá — Zernio to jen sdružuje do
jednoho dashboardu.

**Stav (kontrola 2026-07-27):**

- `ZERNIO_API_KEY` (`sk_...`) v `.env.local` i Vercelu ✅
- WABA (WhatsApp Business Account) — chybí
- Registrované phone number ve WABA — chybí
- Schválená template `access_code` — chybí
- **Kód aplikace** (`src/lib/integrations/whatsapp.ts`) — pořád volá **přímo
  Meta Cloud API**, ne Zernio. Bez rewrite adapteru se pošle žádný request na
  Zernio, i když má klíč. Rewrite je samostatný TODO, potřebuje explicit GO.

### 6a. Zernio dashboard — WABA a phone number

**Kde:** <https://zernio.com/dashboard> → WhatsApp / Platforms

**Co udělat:**

1. **Propojit Meta účet** (Zernio provede přes `/connect/whatsapp` flow, který
   dovede do Meta OAuth). Bez existujícího Meta Business účtu si ho nejdřív
   založ v <https://business.facebook.com/>.
2. **Registrovat WABA** — buď spároval existující (pokud má klient WhatsApp
   Business SIM/číslo), nebo v Zernio provisioning nové.
3. **Verifikovat phone number** ve WABA (SMS/hovor kód od Meta).
4. Zkopíruj hodnoty, které Zernio dashboard ukáže po propojení, do prostředí
   (přesná jména proměnných budou známa po přechodu adapteru — viz 6c).

### 6b. Template `access_code` — Meta schválení

**Kde:** Zernio dashboard → Templates (interně to jde na Meta review).

**Co udělat:**

Vytvoř template se jménem `access_code`, jazykem `cs`, kategorií `Utility`.
Text template s dvěma placeholdery `{{1}}` (kód) a `{{2}}` (čas rezervace).
Vzor:

```
Vaše rezervace na {{2}} je potvrzena. Vstupní kód: {{1}}
Kód zadejte na klávesnici u dveří v čase rezervace.
```

Odešli k review → **schválení trvá typicky 1–24 h** (může být 1–7 dní podle
zátěže). Zernio ukáže stav `approved`.

### 6c. Rewrite `whatsapp.ts` adapteru ⚠️ vyžaduje odsouhlasení

**Proč:** aktuální adapter volá přímo Meta Graph API
(`https://graph.facebook.com/.../messages`), ne Zernio. S `ZERNIO_API_KEY`
alone se v produkci pošle nula zpráv, protože adapter Zernio API nezná.

**Zernio endpointy k použití** (per docs.zernio.com):
- `POST /broadcasts/create-broadcast` — pošle template message s per-recipient
  proměnnými (přesně náš use case).
- Alternativně `POST /inbox/conversations/{id}/messages` pro odpověď do 24 h.

**Co je potřeba odsouhlasit:**
- Přepsat `src/lib/integrations/whatsapp.ts`, aby volal Zernio místo Meta.
- Přejmenovat env vars z `WHATSAPP_*` na `ZERNIO_*` (nebo nechat jméno modulu
  `whatsapp` a jen změnit implementaci — kloním se k druhému, protože doména
  je pořád WhatsApp; Zernio je jen provider).
- Odstranit stará env vars `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET` — po přechodu
  nepotřebné. `WHATSAPP_VERIFY_TOKEN` může ještě zbýt, pokud Zernio umí
  webhook forwarding pod naší doménou (nebylo v docs jasné).

Řekni **GO** a udělám to jako samostatný commit s testem shape všech Zernio
volání proti live sandboxu.

**Jak poznám, že celé 6 vyšlo:** vytvořím rezervaci, v `message_delivery` se
objeví row `channel='whatsapp'`, `status='sent'`, Zernio dashboard ukazuje
odchozí broadcast do klientova telefonu, klient dostane zprávu s kódem.

**Čas:** 30 min setup + review template 1–24 h + code rewrite ~1 h.

---

## 7. GoSMS (fallback SMS kanál)

*Proč to nejde automatizovat:* GoSMS nemá veřejné self-serve API pro
vygenerování client credentials — vyžaduje účet, výběr tarifu a ruční
vygenerování OAuth klíčů v jejich portálu.

**Kde:** <https://app.gosms.cz/> → API sekce v nastavení účtu.

**Co vzít:**

- Vygeneruj **OAuth client credentials** (client_id + client_secret) →
  `GOSMS_CLIENT_ID`, `GOSMS_CLIENT_SECRET`.
- Zvol/založ **channel** (odesílací kanál) a zkopíruj jeho číselné ID →
  `GOSMS_CHANNEL`.
- Přidej všechny tři do `.env.local` (test) a do Vercel Production + Preview
  jako **Sensitive**.

**Jak poznám, že to vyšlo:** v adminu editace profilu člena zaškrtnu
"Posílat kódy přes SMS", vytvořím rezervaci, v `message_delivery` se objeví
řádek s `channel='sms'` a `status='sent'`, a GoSMS dashboard ukazuje
odchozí zprávu.

**Poznámka:** SMS je opt-in fallback per-member. Bez `GOSMS_CLIENT_ID` a
`GOSMS_CHANNEL` se SMS větev v dispatcheru přeskakuje (bez chyby).

**Čas:** 30 min od vygenerování klíčů.

---

## 8. Sentry + uptime monitoring

*Proč to nejde automatizovat:* vytvoření projektu a auth tokenu vyžaduje
Dashboard, uptime monitor je externí služba.

**Kde:** <https://sentry.io/> (project = Next.js) a
<https://uptimerobot.com/> nebo alternativa.

**Co vzít:**

- `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`,
  `SENTRY_AUTH_TOKEN` (org-level token s `project:releases` scopem pro
  upload source map).
- V UptimeRobot přidej: veřejnou URL (`https://gym-plzen.vercel.app/`), cron
  heartbeat URL (nebo interval-based check na `/api/cron/watchdog`).

---

# Blokované — čekají na klientův nákup

Tyto kroky nejde teď dokončit. Vrátí se do horní části seznamu, jakmile
klient pořídí příslušnou položku.

---

## 9. Nuki (fyzický zámek) ⏸ blokované — čeká na koupi zámku klientem

*Proč to nejde automatizovat:* vyžaduje fyzické spárování zámku a otestování.

**Kde:** <https://web.nuki.io/>

**Stav (kontrola 2026-07-27):**

- `NUKI_API_TOKEN` — v `.env.local` i Vercelu ✅
- `NUKI_SMARTLOCK_ID` — bude až po pořízení zámku (číselné ID vybraného zámku
  z Nuki web dashboardu).
- `NUKI_WEBHOOK_SECRET` — chybí; vygeneruj silný string
  (`openssl rand -hex 32`) a zapiš současně do Nuki webhook UI i do Vercelu
  (Sensitive, Production + Preview).
- **Webhook URL k zaregistrování na Nuki:**
  `https://gym-plzen.vercel.app/api/webhooks/nuki` (po přechodu na vlastní
  doménu přepiš).

**Fyzicky ověř:** vytvoř přes admin novou rezervaci, kód se doručí, zámek
otevře; po skončení kód přestane platit; ruční revocation zafunguje.

**Čas po pořízení zámku:** 1–2 h (klientské místo).

---

## 10. Resend — vlastní doména ⏸ blokované — čeká na koupi domény klientem

**Stav (kontrola 2026-07-27):**

- `RESEND_API_KEY` (`re_...`) v `.env.local` i Vercelu ✅
- `RESEND_FROM_EMAIL` (Resend `onboarding@resend.dev` testovací odesílatel)
  v `.env.local` i Vercelu ✅. Doručuje **jen na e-maily uložené na tvém
  Resend účtu** (typicky vlastník), stačí to na ověření flow.

**Co zbývá (blokované odložením domény):**

1. Až pořídíš vlastní doménu, přidej ji v <https://resend.com/domains>.
2. Vlož SPF/DKIM/DMARC záznamy, které Resend vypíše, do registrátora.
3. Klikni **Verify** — po propagaci DNS se změní stav na `Verified`.
4. Přepiš `RESEND_FROM_EMAIL` v `.env.local` i Vercelu na
   `NAMASTÉ Private Gym <noreply@<vlastní-doména>>`.

**Jak poznám, že to vyšlo:** test e-mail z aplikace dorazí bez SPF failu,
Resend logs ukazují `delivered`.

**Čas po pořízení domény:** 30 min + čekání na DNS.

---

## 11. Poznámky mimo tento seznam

- `.env.local` a všechny výše uvedené klíče **nikdy** necommituj. Kontrola:
  `.gitignore` už `.env.local` obsahuje.
- Po pořízení vlastní domény (odloženo) a nastavení Supabase Auth (2) proveď
  v prohlížeči úplný reálný test: registrace, magic-link, přihlášení,
  ilustrační rezervace, admin sekce vyžaduje admin roli.
- Bezpečnostní hlavičky (CSP, HSTS, frame protection) jsou v kódu; ověř je
  po produkčním deployi přes <https://securityheaders.com/>.
