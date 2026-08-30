# Co je potřeba dokončit mimo repozitář

Externí a klientské kroky. Manuální detaily viz [MANUAL_STEPS.md](./MANUAL_STEPS.md).

## Přehled úkolů

`[imp:N]` = priorita 1–5, `[owner:me]` = externí krok, `[owner:ai]` = úkol pro
AI po dodání podkladů. `[kind:K]` ∈ `setup` `deploy` `legal` `content` `decision`.

- [ ] **Nahradit zástupný kontaktní e-mail**: v patičce a na webu je zatím `info@namastegym.cz` (zástupná hodnota pro layout). Přepsat na skutečný v administraci → Obsah webu (`contact.email`). `[imp:5]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Nahradit neplatný klíč Google mapy**: produkce 15. 8. 2026 vrací `InvalidKeyMapError`; nasazená hodnota není Googlem rozpoznána jako API klíč. V Google Cloud → Credentials zkopírovat skutečnou hodnotu API key (obvykle začíná `AIza`), zapnout billing a Maps JavaScript API, nastavit HTTP referrery `https://namastegym.cz/*` a `https://www.namastegym.cz/*`, uložit ve Vercelu jako `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` pro Production a znovu nasadit. Volitelný vlastní Map ID patří samostatně do `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Do té doby web použije bezpečný Google embed se standardním markerem. `[imp:4]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Povolit synchronizaci Auth e-mailů z administrace**: vytvořit Supabase Personal Access Token, uložit ho ve Vercelu jako `SUPABASE_MANAGEMENT_API_TOKEN` pro Production a Preview a nasadit novou verzi. Poté administrace → E-maily propisuje šablony „Potvrzení registrace“ a „Obnova hesla“ do Supabase Auth. Přesný postup je v §7 [MANUAL_STEPS.md](./MANUAL_STEPS.md#7-supabase-auth-smtp--registrace-a-obnova-hesla). `[imp:5]` `[owner:me]` `[time:10m]` `[kind:setup]`
- [ ] **Ostrý test e-mailového workflow**: vytvořit novou testovací registraci, provést reset hesla a z administrace odeslat test všech pěti šablon. V Resend Logs ověřit doručení, český text, logo a sender. `[imp:5]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [x] **Text obchodních podmínek**: dodané VOP s účinností od 17. 8. 2026 jsou zveřejněné na `/obchodni-podminky` a propojené s rezervací i patičkou. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:legal]`
- [ ] **Migrace 0007 v dalších prostředích**: `drizzle/0007_reservation_consents.sql` přidává do tabulky `reservation` sloupce `rules_accepted_at` a `terms_accepted_at`. Na nakonfigurované databázi je už aplikovaná; pokud existuje další prostředí (staging, druhý Supabase projekt), spustit ji i tam, jinak se rezervace neuloží. `[imp:5]` `[owner:me]` `[time:10m]` `[kind:deploy]`
- [ ] **Ostrý test rezervace bez registrace**: po zapojení Stripe live projít celý host checkout (vyplnit údaje, zaplatit, ověřit doručení potvrzení a přístupového kódu na e-mail i telefon zadaný ve formuláři) a zkontrolovat, že se v administraci rezervace zobrazuje bez účtu. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Fotografie jednotlivých zón**: dodat snímky pro dlaždice na `/vybaveni` (silová, kardio, strečink, dětský koutek, lednice, zázemí). Zatím se zobrazuje značková výplň s lotosem. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:content]`
- [ ] **Značka české přírodní kosmetiky**: v textu kroku „Před odchodem“ byla v podkladu vynechaná („od značky …“). Dokud ji nedodáte, web uvádí jen „česká přírodní kosmetika“ bez názvu. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Stripe webhook**: zaregistrovat endpoint v Stripe Dashboardu (test i live), zkopírovat signing secret do `STRIPE_WEBHOOK_SECRET`. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Zernio (WhatsApp) provisioning**: propojit Meta účet, registrovat WABA, verifikovat phone number, nechat schválit template `access_code`. Poté vyžádat GO na rewrite `src/lib/integrations/whatsapp.ts` z Meta Graph na Zernio. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Nuki: fyzický zámek** (čeká na nákup): doplnit `NUKI_SMARTLOCK_ID`, vygenerovat `NUKI_WEBHOOK_SECRET`, fyzicky ověřit vytvoření/expiraci/revokaci kódu. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **Přihlášení přes Google v Safari**: klientka hlásí, že se přesměrování nedokončí. Kód už chybu nezametá — nepovedený návrat končí na `/login` s českou hláškou. Zbývá ověřit v Supabase → Authentication → URL Configuration, že `Site URL` i `Redirect URLs` obsahují **přesně tu doménu, na které web běží**, včetně varianty s `www` i bez ní, a že sedí s `NEXT_PUBLIC_APP_URL` ve Vercelu. Nesoulad hostitelů je nejčastější příčina: cookie s PKCE ověřovatelem se pak s návratem nepošle. Po úpravě zkusit přihlášení v Safari znovu a poslat případnou hlášku. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Navazující nastavení vlastní domény**: veřejný web již běží na vlastní doméně. Před ostrým provozem ještě potvrdit `NEXT_PUBLIC_APP_URL`, `Site URL` v Supabase, Stripe webhook URL a Nuki webhook URL. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Plné E2E proti testovacím službám**: po připojení Stripe test / Nuki / Resend / WhatsApp spustit Playwright suite s mutačním povolením. `[imp:2]` `[owner:ai]` `[time:1h]` `[kind:deploy]`
- [ ] **Vybrat funkce z Mobbin rešerše**: projít [docs/FEATURE_IDEAS.md](./docs/FEATURE_IDEAS.md) (top 5: věrnostní progres, potvrzení rezervace+, admin „Dnes“, dárkové poukazy, hlídání termínu) a odsouhlasit, co se bude stavět. U poukazů dodat pravidla expirace, storna a částky. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:decision]`

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
