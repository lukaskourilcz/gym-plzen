# Co je potřeba dokončit mimo repozitář

Externí a klientské kroky. Manuální detaily viz [MANUAL_STEPS.md](./MANUAL_STEPS.md).

## Přehled úkolů

`[imp:N]` = priorita 1–5, `[owner:me]` = externí krok, `[owner:ai]` = úkol pro
AI po dodání podkladů. `[kind:K]` ∈ `setup` `deploy` `legal` `content` `decision`.

- [ ] **Nahradit zástupné kontaktní údaje**: v patičce a na webu je zatím `777 666 555` a `info@namastegym.cz` (zástupné hodnoty pro layout). Přepsat na skutečné v administraci → Obsah webu (`contact.phone`, `contact.email`). `[imp:5]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Povolit synchronizaci Auth e-mailů z administrace**: vytvořit Supabase Personal Access Token, uložit ho ve Vercelu jako `SUPABASE_MANAGEMENT_API_TOKEN` pro Production a Preview a nasadit novou verzi. Poté administrace → E-maily propisuje šablony „Potvrzení registrace“ a „Obnova hesla“ do Supabase Auth. Přesný postup je v §7 [MANUAL_STEPS.md](./MANUAL_STEPS.md#7-supabase-auth-smtp--registrace-a-obnova-hesla). `[imp:5]` `[owner:me]` `[time:10m]` `[kind:setup]`
- [ ] **Ostrý test e-mailového workflow**: vytvořit novou testovací registraci, provést reset hesla a z administrace odeslat test všech pěti šablon. V Resend Logs ověřit doručení, český text, logo a sender. `[imp:5]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Text provozního řádu**: stránka `/provozni-rad` (odkazovaná z patičky) vykresluje blok `home.rules.body`. Dodat a schválit finální znění. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:content]`
- [ ] **Fotografie jednotlivých zón**: dodat snímky pro dlaždice na `/vybaveni` (silová, kardio, strečink, dětský koutek, lednice, zázemí). Zatím se zobrazuje značková výplň s lotosem. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:content]`
- [ ] **Odkaz na Facebook**: v administraci → Obsah webu přepsat zástupnou hodnotu bloku `contact.facebook` skutečnou URL. Instagram je potvrzený jako `@namaste_plzen`. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Odkaz na WhatsApp do patičky**: v administraci → Obsah webu vyplnit blok `contact.whatsapp` ve tvaru `https://wa.me/420XXXXXXXXX`. Do té doby se ikonka WhatsAppu v patičce nezobrazuje. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Značka české přírodní kosmetiky**: v textu kroku „Před odchodem“ byla v podkladu vynechaná („od značky …“). Dokud ji nedodáte, web uvádí jen „česká přírodní kosmetika“ bez názvu. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Stripe webhook**: zaregistrovat endpoint v Stripe Dashboardu (test i live), zkopírovat signing secret do `STRIPE_WEBHOOK_SECRET`. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Zernio (WhatsApp) provisioning**: propojit Meta účet, registrovat WABA, verifikovat phone number, nechat schválit template `access_code`. Poté vyžádat GO na rewrite `src/lib/integrations/whatsapp.ts` z Meta Graph na Zernio. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Nuki: fyzický zámek** (čeká na nákup): doplnit `NUKI_SMARTLOCK_ID`, vygenerovat `NUKI_WEBHOOK_SECRET`, fyzicky ověřit vytvoření/expiraci/revokaci kódu. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **Přihlášení přes Google v Safari**: klientka hlásí, že se přesměrování nedokončí. Kód už chybu nezametá — nepovedený návrat končí na `/login` s českou hláškou. Zbývá ověřit v Supabase → Authentication → URL Configuration, že `Site URL` i `Redirect URLs` obsahují **přesně tu doménu, na které web běží**, včetně varianty s `www` i bez ní, a že sedí s `NEXT_PUBLIC_APP_URL` ve Vercelu. Nesoulad hostitelů je nejčastější příčina: cookie s PKCE ověřovatelem se pak s návratem nepošle. Po úpravě zkusit přihlášení v Safari znovu a poslat případnou hlášku. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Navazující nastavení vlastní domény**: veřejný web již běží na vlastní doméně. Před ostrým provozem ještě potvrdit `NEXT_PUBLIC_APP_URL`, `Site URL` v Supabase, Stripe webhook URL a Nuki webhook URL. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
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
