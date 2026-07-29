# Co je potřeba dokončit mimo repozitář

Externí a klientské kroky. Manuální detaily viz [MANUAL_STEPS.md](./MANUAL_STEPS.md).

## Přehled úkolů

`[imp:N]` = priorita 1–5, `[owner:me]` = externí krok, `[owner:ai]` = úkol pro
AI po dodání podkladů. `[kind:K]` ∈ `setup` `deploy` `legal` `content` `decision`.

- [ ] **Nahradit zástupné kontaktní údaje**: v patičce a na webu je zatím `777 666 555` a `info@namastegym.cz` (zástupné hodnoty pro layout). Přepsat na skutečné v administraci → Obsah webu (`contact.phone`, `contact.email`). `[imp:5]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Doseedovat nové bloky obsahu**: `npm run db:seed` nově zakládá bloky pro šest kroků „Jak to u nás funguje“, závěrečnou výzvu, provozní řád a sociální sítě. Bez něj se texty zobrazují z výchozích hodnot v kódu a nejdou editovat v administraci. `[imp:3]` `[owner:me]` `[time:5m]` `[kind:setup]`
- [ ] **Text provozního řádu**: stránka `/provozni-rad` (odkazovaná z patičky) vykresluje blok `home.rules.body`. Dodat a schválit finální znění. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:content]`
- [ ] **Fotografie jednotlivých zón**: dodat snímky pro dlaždice na `/vybaveni` (silová, kardio, strečink, dětský koutek, lednice, zázemí). Zatím se zobrazuje značková výplň s lotosem. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:content]`
- [ ] **Odkazy na Facebook a Instagram**: v administraci → Obsah webu přidat bloky s klíči `contact.facebook` a `contact.instagram` (nebo je nechat vytvořit přes `npm run db:seed`) a vyplnit URL. Patička ikonky zobrazí až po vyplnění. `[imp:2]` `[owner:me]` `[time:10m]` `[kind:content]`
- [ ] **Značka české přírodní kosmetiky**: v textu kroku „Před odchodem“ byla v podkladu vynechaná („od značky …“). Dokud ji nedodáte, web uvádí jen „česká přírodní kosmetika“ bez názvu. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Stripe webhook**: zaregistrovat endpoint v Stripe Dashboardu (test i live), zkopírovat signing secret do `STRIPE_WEBHOOK_SECRET`. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Zernio (WhatsApp) provisioning**: propojit Meta účet, registrovat WABA, verifikovat phone number, nechat schválit template `access_code`. Poté vyžádat GO na rewrite `src/lib/integrations/whatsapp.ts` z Meta Graph na Zernio. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Nuki: fyzický zámek** (čeká na nákup): doplnit `NUKI_SMARTLOCK_ID`, vygenerovat `NUKI_WEBHOOK_SECRET`, fyzicky ověřit vytvoření/expiraci/revokaci kódu. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **Vlastní doména + HTTPS** (čeká na nákup): DNS, HTTPS, přepsat `NEXT_PUBLIC_APP_URL`, `Site URL` v Supabase, Stripe webhook URL, Nuki webhook URL. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Resend: vlastní doména** (čeká na doménu): přidat v Resend, SPF/DKIM/DMARC, přepsat `RESEND_FROM_EMAIL`. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Plné E2E proti testovacím službám**: po připojení Stripe test / Nuki / Resend / WhatsApp spustit Playwright suite s mutačním povolením. `[imp:2]` `[owner:ai]` `[time:1h]` `[kind:deploy]`

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
