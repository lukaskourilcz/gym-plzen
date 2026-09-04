# Co je potřeba dokončit mimo repozitář

Externí a klientské kroky. Manuální detaily viz [MANUAL_STEPS.md](./MANUAL_STEPS.md).

## Přehled úkolů

`[imp:N]` = priorita 1–5, `[owner:me]` = externí krok, `[owner:ai]` = úkol pro
AI po dodání podkladů. `[kind:K]` ∈ `setup` `deploy` `legal` `content` `decision`.

- [ ] **Potvrdit kontaktní e-mail `info@navigym.cz`**: klient ho založil 4. 9.; kód ho nastaví jako výchozí (`contact.email`). Ověřit, že schránka přijímá poštu, a zkontrolovat hodnotu v administraci → Obsah webu. `[imp:5]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Logo NAVI ve vektoru**: od klienta získat SVG/PDF (nebo PNG s průhledným pozadím) samotného znaku (kettlebell s N), wordmarku a celého lockupu, ve zlaté i jednobarevné verzi, plus variantu pro světlé pozadí e-mailů. Dodaná vizualizace je jen 3D náhled a slouží jako dočasný raster. Uložit do `public/images/` podle issue B. Plán: [docs/NAVI_REBRAND_PLAN.md](./docs/NAVI_REBRAND_PLAN.md). `[imp:5]` `[owner:me]` `[time:1h]` `[kind:content]`
- [ ] **Rozhodnout o doméně**: zůstává web na `namastegym.cz`, nebo se stěhuje na `navigym.cz`? Při stěhování dodat přístup k DNS a projít `MANUAL_STEPS.md` §10 (Vercel doména, Resend, Supabase URL, Stripe a Nuki webhooky, `NEXT_PUBLIC_APP_URL`, 301 ze staré domény, Search Console). `[imp:5]` `[owner:me]` `[time:15m]` `[kind:decision]`
- [ ] **Aktualizované VOP a provozní řád**: klient dodá znění s názvem NAVI Private Gym, novou doménou a e-mailem (případně novým subjektem). Jsou to právní texty, kód je nepřepisuje strojově. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:legal]`
- [ ] **Potvrdit hero text**: navrženo „Tvůj čas. Tvůj prostor. Tvoje NAVI.“ (`home.hero.titleAccent` = „NAVI.“). Případnou jinou formulaci upravit v administraci → Obsah webu. `[imp:4]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **GA4 a Meta Pixel pro NAVI**: po nasazení issue K nastavit ve Vercelu `NEXT_PUBLIC_GA_MEASUREMENT_ID` (nová GA4 property, nebo přejmenovaná stávající) a `NEXT_PUBLIC_META_PIXEL_ID`; bez hodnot se měření nenačte. Google Merchant Center se pro rezervace fitness nepoužívá; místo něj Firemní profil na Googlu a konverze GA4 → Google Ads. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Odesílatel e-mailů NAVI**: ve Vercelu změnit `RESEND_FROM_EMAIL` na `NAVI Private Gym <noreply@…>`; pro odesílání z `@navigym.cz` nejdřív ověřit doménu v Resendu (DNS záznamy) a stejně upravit SMTP sender v Supabase Auth. Do té doby zůstává doména `namastegym.cz` s novým jménem odesílatele. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Předat administraci do st 9. 9.**: získat e-maily, pod kterými se správkyně na webu zaregistrují, a po nasazení issue H jim v administraci → Členové nastavit roli správce (do té doby `npm run set-admin -- email`). Zaškolit v Obsah webu a E-maily. `[imp:5]` `[owner:me]` `[time:45m]` `[kind:setup]`
- [ ] **Ilustrační fotografie**: vygenerovat kvalitní atmosférické snímky fitness (ne „naše prostory“), nahrát přes administraci jako hero, fotku za sekcemi, galerii a zóny (po nasazení issue G). Web je označí „Ilustrační foto“; po dodání vlastních fotografií je klient vymění sám. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:content]`
- [ ] **Rozhodnout o fakturách**: (a) automatické potvrzení platby ze Stripe (zapnout v dashboardu, bez kódu), (b) Fakturoid přes integraci (účet, API klíč, fakturační údaje; 2–3 dny práce), (c) měsíční export pro účetní. Doporučeno (a) hned a (b) až po rozhodnutí. `[imp:3]` `[owner:me]` `[time:15m]` `[kind:decision]`
- [ ] **Nastavit říjnovou akci a horizont**: po nasazení issues D a E v administraci → Členství zadat akci 199 Kč, 1. 10. 2026 00:00 až 31. 10. 2026 23:59, a v Nastavení horizont 130 dní. Standardní cena 289 Kč platí automaticky mimo okno. Před 1. 10. udělat zkušební rezervaci. `[imp:5]` `[owner:me]` `[time:15m]` `[kind:setup]`
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
- [ ] **Posoudit variantu „Moderní“ a rozhodnout o výchozím vzhledu**: na webu je vpravo nahoře přepínač Klasický / Moderní (na mobilu v menu). Projít úvodní stránku, Vybavení a účet v obou podobách a rozhodnout, která zůstane. Po schválení se Moderní nastaví jako výchozí a přepínač se odstraní. `[imp:3]` `[owner:me]` `[time:20m]` `[kind:decision]`
- [ ] **Ostrý test přílohy kalendáře**: po zapojení Resend v ostrém provozu ověřit, že potvrzovací e-mail nese přílohu `rezervace.ics` a že se termín správně naimportuje do Google i Apple kalendáře (letní i zimní čas). `[imp:3]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Posoudit variantu „Moderní“ a rozhodnout o výchozím vzhledu**: otevřít `namastegym.cz/dev` (tím se přepínač odemkne jen ve vašem prohlížeči, návštěvníci ho nevidí) a projít úvodní stránku, Vybavení a účet v obou podobách. Po rozhodnutí nastavíme vybranou podobu jako výchozí a přepínač i stránku `/dev` odstraníme. `[imp:3]` `[owner:me]` `[time:20m]` `[kind:decision]`
- [ ] **Ostrý test přílohy kalendáře**: po zapojení Resend v ostrém provozu ověřit, že potvrzovací e-mail nese přílohu `rezervace.ics` a že se termín správně naimportuje do Google i Apple kalendáře (letní i zimní čas). `[imp:3]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Plné E2E proti testovacím službám**: po připojení Stripe test / Nuki / Resend / WhatsApp spustit Playwright suite s mutačním povolením. `[imp:2]` `[owner:ai]` `[time:1h]` `[kind:deploy]`
- [x] **Vybrat funkce z Mobbin rešerše**: rozhodnuto. Staví se věrnostní progres, „Přidat do kalendáře“ (bez pozvánek hostů), administrace „Dnes“ a balíček moderního designu s přepínačem Klasický/Moderní; poukazy a hlídání termínu se nestaví. Plán: [docs/MODERN_PLAN.md](./docs/MODERN_PLAN.md). `[imp:3]` `[owner:me]` `[time:30m]` `[kind:decision]`

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
