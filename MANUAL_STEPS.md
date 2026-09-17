# Manuální kroky

Kroky, které vyžadují Dashboard, externí konzoli nebo fyzické ověření.
Produkční web běží na **`https://www.navigym.cz`** (od 5. 9. 2026).
`namastegym.cz` zatím servíruje stejný web souběžně, než se z něj udělá 301.

Při změně domény vždy aktualizujte také Supabase Auth URL, Comgate webhook,
Nuki webhook a referrery klíče Google mapy.

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

- `https://www.navigym.cz`

URL Configuration → Redirect URLs:

- `http://localhost:3000/**`
- `https://*.vercel.app/**`
- `https://www.navigym.cz/**`
- `https://www.namastegym.cz/**` (dokud stará doména běží)

**Ověření:** `POST /login` s platným e-mailem vrátí `Zkontrolujte e-mail`;
v Auth logu vidíš `user_created` a `magic_link_sent`.

---

## 2. Vercel: Node 22 a env variables

**Node.js Version** — `https://vercel.com/<team>/gym-plzen/settings/general` → **22.x**.
Bez toho Vercel spustí default runtime.

**Environment Variables** — `https://vercel.com/<team>/gym-plzen/settings/environment-variables`.

Přenést z `.env.local` do Vercel Production + Preview:

Public (Sensitive OFF):

- `NEXT_PUBLIC_APP_URL` = `https://www.navigym.cz`
- `NEXT_PUBLIC_DEFAULT_LOCALE` = `cs`
- `NEXT_PUBLIC_OAUTH_PROVIDERS` = `google`
- `NEXT_PUBLIC_SENTRY_DSN`

Server-only (Sensitive ON):

- `COMGATE_MERCHANT_ID`, `COMGATE_SECRET`, `COMGATE_TEST_MODE` (viz §3)
- `SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- `GOSMS_CLIENT_ID`, `GOSMS_CLIENT_SECRET`, `GOSMS_CHANNEL`
- `CRON_SECRET` = vygeneruj `openssl rand -hex 32`
- `ALERT_WHATSAPP_RECIPIENTS`
- Nuki webhook secret a Zernio konfigurace až budou (viz §4, §5)

`DEMO_AUTH_ENABLED` a `BOOKING_PREVIEW_FIXTURE` do produkce **nedávat**.

**Sensitive flag** chrání hodnoty před vyčtením v Dashboardu (screen-share);
runtime i `vercel env pull` je dostanou normálně.

---

### Analytika (GA4 a Meta Pixel)

Měřicí ID nejsou v kódu. Ve Vercelu nastav pro Production i Preview:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — GA4 Measurement ID (`G-…`) nové property NAVI.
- `NEXT_PUBLIC_META_PIXEL_ID` — Meta Pixel / Dataset ID.

Bez hodnoty se příslušný skript vůbec nenačte a lišta souhlasu danou kategorii
nenabídne. Google Merchant Center se pro rezervace fitness nepoužívá; místo něj
Firemní profil na Googlu a konverze GA4 → Google Ads.

## 3. Comgate platby

Postup v [docs/COMGATE_SETUP.md](docs/COMGATE_SETUP.md). Bez klíčů jsou platby vypnuté.
Testy provádějte v odděleném Preview/stagingu; produkční Vercel odmítá testovací režim.
Po ověření přístupů zapněte platby v administraci → Nastavení → Provoz rezervací.
Zámek se zapíná samostatně až po fyzickém ověření. Rezervace vyžaduje úhradu;
termín lze vybrat dopředu podle nastaveného kalendářního horizontu.
Starý Stripe endpoint a nepoužívané Stripe proměnné odstraňte v externích konzolích.

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

## 5. Nuki (fyzický zámek) — připojit před otevřením 1. 10. 2026

**Kde:** <https://web.nuki.io/>.

Bez kliky zákazníci nevstupují (rozhodnutí provozovatele 17. 9. 2026), proto
musí být zámek připojený a ověřený do 30. 9. 2026. Po instalaci doplnit:

- `NUKI_API_TOKEN` (API token z Nuki Web; Vercel → Sensitive, Production + Preview).
- `NUKI_SMARTLOCK_ID` (číselné ID zámku z dashboardu).
- `NUKI_WEBHOOK_SECRET` = `openssl rand -hex 32`; zapsat současně do Nuki webhook UI i do Vercelu (Sensitive, Production + Preview).
- Webhook URL k zaregistrování na Nuki: `https://www.navigym.cz/api/webhooks/nuki`
  (**čeká na přepnutí**, viz NEEDED.md).

**Fyzicky ověřit:** admin vytvoří rezervaci → kód doručen → zámek otevře →
po skončení kód přestane platit → ruční revocation zafunguje.

Vstupní kódy se zapínají až po tomto ověření v administraci → **Nastavení a
branding** → „Aktivovat vstupní kódy přes Nuki“, a až po opravě
[issue #64](https://github.com/lukaskourilcz/gym-plzen/issues/64) (adaptér
musí po vytvoření kódu dohledat id autorizace; bez opravy skončí každá
rezervace ve stavu „neznámý výsledek“). Viz NEEDED.md.

---

## 6. Resend — odchozí aplikační e-maily

Vercel má nastavené `RESEND_API_KEY` a `RESEND_FROM_EMAIL` pro Production i
Preview. 17. 9. 2026 bylo ověřeno, že aplikační e-maily (potvrzení rezervace,
změna termínu) i registrační e-mail Supabase Auth chodí z
`noreply@navigym.cz`; doména `navigym.cz` je tedy v Resendu ověřená.

- Sender: `NAVI Private Gym <noreply@navigym.cz>`. Ve Vercelu má být
  `RESEND_FROM_EMAIL="NAVI Private Gym <noreply@navigym.cz>"`; 17. 9. 2026 tam
  bylo ještě jméno „Namasté Private Gym“ a e-maily pod ním odcházely. Od téže
  verze kód jméno odesílatele nastavuje sám (z proměnné bere jen adresu),
  proměnnou přesto opravit.
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
   - Sender email: `noreply@navigym.cz`
   - Sender name: `NAVI Private Gym` (17. 9. 2026 tam bylo „Namasté Private
     Gym“; propsání šablon z administrace jméno přepíše samo, ruční oprava je
     ale okamžitá)
   - Host: `smtp.resend.com`
   - Port: `465` (SSL / implicit TLS)
   - Username: `resend`
   - Password: stejný Resend API key jako `RESEND_API_KEY` ve Vercelu
3. Uložit. Při vkládání API klíče jej nikam jinam nekopírovat a nikdy jej
   necommitovat.

### Zpřístupnění šablon v administraci

1. Otevřít <https://supabase.com/dashboard/account/tokens> (přihlášení účtem,
   pod kterým je projekt `rkmunagymohxtclymacm`) → **Generate new token**,
   pojmenovat např. `navigym-auth-templates` a hodnotu hned zkopírovat —
   zobrazí se jen jednou. Token má přístup k celému účtu Supabase, proto patří
   jen do Vercelu a nikam jinam; na stejné stránce ho lze kdykoli zrušit.
2. Ve Vercelu → projekt → **Settings → Environment Variables → Add**: Key
   `SUPABASE_MANAGEMENT_API_TOKEN`, Value = token, prostředí **Production** i
   **Preview**, zaškrtnout **Sensitive**, uložit.
3. Proměnná platí až pro nový deployment: **Deployments → poslední Production
   deployment → ⋯ → Redeploy** (nebo počkat na další push do `main`).
4. V administraci webu → **E-maily**. Nad šablonami je stav propojení:
   zelené „Propojení se Supabase Auth funguje“ (obě šablony propsané), žluté
   „šablony čekají na uložení“ (token funguje, jmenované šablony zbývá
   uložit), žluté „Šablony Supabase Auth se nepropisují“ (proměnná chybí nebo
   běží deployment z doby před jejím přidáním), nebo červené „Propojení se
   Supabase Auth selhalo“ s HTTP stavem a hláškou API (nejčastěji token z
   jiného účtu, HTTP 401/403). Otevřít „Potvrzení registrace“, kliknout
   **Uložit šablonu** (text není nutné měnit) a totéž udělat pro „Obnova
   hesla“. Úspěch potvrdí hláška „Šablona uložená a propsaná do Supabase
   Auth.“; červená hláška po uložení říká, proč propsání selhalo. Stav uvádí
   i jméno odesílatele v Supabase Auth; uložení kterékoli z obou šablon ho
   nastaví na „NAVI Private Gym“.
   Aplikace v bezpečném serverovém volání propíše český předmět, text, logo
   a tlačítko do hostovaného Supabase Auth. Token se nikdy neposílá do
   prohlížeče.

Tlačítko v šabloně nevede na výchozí `{{ .ConfirmationURL }}`, ale na
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&redirect_to={{ .RedirectTo }}`
(u obnovy hesla `type=recovery`). Výchozí odkaz dokončí přihlášení jen v
prohlížeči, ve kterém registrace začala (PKCE): odkaz otevřený v aplikaci
Gmail nebo na jiném zařízení adresu sice potvrdí, ale skončí na přihlášení
hláškou „Otevřete přímo www.navigym.cz“ (ověřeno 17. 9. 2026). Adresa
`/auth/confirm` ověří token na serveru a přihlásí zákazníka tam, kde odkaz
otevřel. Dokud šablony nejsou propsané (bez tokenu), Supabase posílá svou
anglickou výchozí šablonu s původním odkazem; kdo ji upravuje ručně v
Supabase → Authentication → Email Templates, použije stejný odkaz jako výše.

**Ověření:**

1. V produkci se zaregistrovat na novou testovací adresu a potvrdit e-mail.
2. Na `/forgot-password` požádat o obnovu a přes e-mail nastavit nové heslo.
3. V administraci odeslat test každé z pěti šablon na vlastní adresu.
4. V Resend Logs ověřit odesílatele `noreply@navigym.cz`, české texty a
   načtené logo.
5. Registrační odkaz otevřít v aplikaci Gmail na telefonu (jiný prohlížeč
   než ten, kde registrace začala): musí skončit přihlášený na účtu, ne na
   `/login` s hláškou.

Ověřeno 17. 9. 2026: registrace i obnova hesla chodí česky s předmětem
„… | NAVI Private Gym“ od `NAVI Private Gym <noreply@navigym.cz>`, oba odkazy
dokončily přihlášení v úplně novém prohlížeči a nové heslo přihlásilo.

---

## 8. Uptime a cron heartbeat monitoring

- UptimeRobot check na `https://www.navigym.cz/`.
- Cron heartbeat monitor pro `/api/cron/watchdog` (nebo přes `UPTIMEROBOT_HEARTBEAT_URL`,
  který cron pinguje po úspěšném běhu — env je nastavené v `.env.local`).

---

## 9. Poznámky

- `.env.local` a všechny výše uvedené klíče **nikdy** necommituj.
- Po nastavení §1 a §2 proveď v prohlížeči úplný reálný test: registrace, magic-link,
  přihlášení, rezervace, admin sekce vyžaduje admin roli.
- Bezpečnostní hlavičky (CSP, HSTS, frame protection) jsou v kódu; ověř je
  po produkčním deployi přes <https://securityheaders.com/>.
