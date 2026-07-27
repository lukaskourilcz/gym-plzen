# Co je potřeba dokončit mimo repozitář

Externí a klientské kroky. Manuální detaily viz [MANUAL_STEPS.md](./MANUAL_STEPS.md).

## Přehled úkolů

`[imp:N]` = priorita 1–5, `[owner:me]` = externí krok, `[owner:ai]` = úkol pro
AI po dodání podkladů. `[kind:K]` ∈ `setup` `deploy` `legal` `content` `decision`.

- [ ] **Přenést tajemství z `.env.local` do Vercelu**: Sentry (`SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`), GoSMS (`GOSMS_CLIENT_ID`, `GOSMS_CLIENT_SECRET`, `GOSMS_CHANNEL`), `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEFAULT_LOCALE`, `NEXT_PUBLIC_OAUTH_PROVIDERS`, `ALERT_WHATSAPP_RECIPIENTS` do Production + Preview (Sensitive kde je to tajemství). `[imp:5]` `[owner:me]` `[time:1h]` `[kind:deploy]`
- [ ] **Supabase Auth Site URL + Redirect URLs**: v Supabase Dashboard nastavit produkční Site URL a wildcard Redirect URLs. `[imp:5]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Vercel Node.js 22**: Settings → General → Node.js Version = 22.x. `[imp:4]` `[owner:me]` `[time:5m]` `[kind:setup]`
- [ ] **Stripe webhook**: zaregistrovat endpoint v Stripe Dashboardu (test i live), zkopírovat signing secret do `STRIPE_WEBHOOK_SECRET`. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Zernio (WhatsApp) provisioning**: propojit Meta účet, registrovat WABA, verifikovat phone number, nechat schválit template `access_code`. Poté vyžádat GO na rewrite `src/lib/integrations/whatsapp.ts` z Meta Graph na Zernio. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Nuki: fyzický zámek** (čeká na nákup): doplnit `NUKI_SMARTLOCK_ID`, vygenerovat `NUKI_WEBHOOK_SECRET`, fyzicky ověřit vytvoření/expiraci/revokaci kódu. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **Vlastní doména + HTTPS** (čeká na nákup): DNS, HTTPS, přepsat `NEXT_PUBLIC_APP_URL`, `Site URL` v Supabase, Stripe webhook URL, Nuki webhook URL. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Resend: vlastní doména** (čeká na doménu): přidat v Resend, SPF/DKIM/DMARC, přepsat `RESEND_FROM_EMAIL`. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Uptime a cron heartbeat monitoring**: UptimeRobot check na produkční URL + cron heartbeat monitor (`UPTIMEROBOT_HEARTBEAT_URL` už je v env). `[imp:3]` `[owner:me]` `[time:30m]` `[kind:deploy]`
- [ ] **Finální obsah**: fotografie, kontakty (e-mail, telefon), seznam vybavení, otevírací doba, pravidla hostů/dětí/storna, hero + logo. `[imp:3]` `[owner:me]` `[time:1h]` `[kind:content]`
- [ ] **Právní texty**: obchodní podmínky a ochrana soukromí — schvaluje provozovatel nebo právník. `[imp:3]` `[owner:me]` `[time:2h]` `[kind:legal]`
- [ ] **Stripe test vs live rozdělení**: `.env.local` drží live klíče. Doporučeno: `.env.local` + Vercel Preview = `sk_test_...`, Vercel Production = `sk_live_...`. `[imp:3]` `[owner:me]` `[time:15m]` `[kind:decision]`
- [ ] **Plné E2E proti testovacím službám**: po připojení Stripe test / Nuki / Resend / WhatsApp spustit Playwright suite s mutačním povolením. `[imp:2]` `[owner:ai]` `[time:1h]` `[kind:deploy]`
- [ ] **Vercel Web Analytics**: zapnout v projektu na Vercelu — dashboard je čte přes Vercel API. `[imp:2]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Analytics po consent rozhodnutí**: nezapínat, dokud není privacy text schválený. `[imp:1]` `[owner:ai]` `[time:2h]` `[kind:legal]`

## Demo účty (Supabase Auth, live DB)

Přihlašovací stránka je záměrně nezobrazuje.

- administrace: `admin@namaste.demo`, heslo `namaste2026`
- klient: `klient@namaste.demo`, heslo `namaste2026`

Volitelný lokální cookie-based demo mód (produkce automaticky vypne):

```dotenv
DEMO_AUTH_ENABLED="true"
DEMO_AUTH_SECRET="nahodny-retezec-alespon-32-znaku"
BOOKING_PREVIEW_FIXTURE="true"
```

## Co do repozitáře nepatří

- databázová hesla;
- Supabase secret / service-role klíče;
- Stripe, Nuki, WhatsApp, Resend, Sentry, GoSMS a cron secrets;
- reálné exporty členů, plateb, logů nebo přístupových kódů;
- lokální `.env.local`.
