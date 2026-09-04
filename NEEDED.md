# Co je potřeba dokončit mimo repozitář

Externí a klientské kroky. Manuální detaily viz [MANUAL_STEPS.md](./MANUAL_STEPS.md).

## Přehled úkolů

`[imp:N]` = priorita 1–5, `[owner:me]` = externí krok, `[owner:ai]` = úkol pro
AI po dodání podkladů. `[kind:K]` ∈ `setup` `deploy` `legal` `content` `decision`.

- [ ] **Ověřit schránku `info@navigym.cz`**: klient ji založil 4. 9.; kód ji už používá jako výchozí kontakt (web, patička, ochrana soukromí). Ověřit, že schránka přijímá poštu, a zkontrolovat hodnotu v administraci → Obsah webu. `[imp:5]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Logo NAVI ve vektoru**: web zatím používá siluety vytažené z dodané 3D vizualizace — tvarem věrné, ale s měkkými hranami renderu. Od klienta získat SVG/PDF znaku, wordmarku a lockupu a nahradit `public/images/navi-mark.png`, `navi-wordmark.png`, `navi-logo.png` a `navi-logo-email.png` (plochá zelená pro e-maily), pak přegenerovat `src/app/icon.png`. V kódu se nemění nic. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:content]`
- [ ] **Profily na sociálních sítích**: web odkazuje na `@namaste_plzen` na Instagramu a na stávající Facebook profil — jsou to skutečné účty, kód je nepřejmenoval. Přejmenovat profily, nebo dodat nové odkazy do administrace → Obsah webu. `[imp:4]` `[owner:me]` `[time:15m]` `[kind:content]`
- [ ] **Rozhodnout o doméně**: zůstává web na `namastegym.cz`, nebo se stěhuje na `navigym.cz`? Při stěhování dodat přístup k DNS a projít `MANUAL_STEPS.md` §10 (Vercel doména, Resend, Supabase URL, Stripe a Nuki webhooky, `NEXT_PUBLIC_APP_URL`, 301 ze staré domény, Search Console). `[imp:5]` `[owner:me]` `[time:15m]` `[kind:decision]`
- [ ] **Aktualizované VOP a provozní řád**: v textech je označení studia přejmenované na NAVI (je to obchodní jméno provozovatele), ale doména `www.namastegym.cz`, e-mail, subjekty a datum účinnosti zůstávají tak, jak je dodal klient. Nechat právně potvrdit a dodat konečné znění. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:legal]`
- [ ] **Potvrdit hero text**: nasazeno „Tvůj čas. Tvůj prostor. Tvoje NAVI.“ Jinou formulaci lze upravit v administraci → Obsah webu. `[imp:3]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **GA4 a Meta Pixel pro NAVI**: nastavit ve Vercelu `NEXT_PUBLIC_GA_MEASUREMENT_ID` (nová GA4 property, nebo přejmenovaná stávající) a `NEXT_PUBLIC_META_PIXEL_ID`; bez hodnot se měření nenačte. Google Merchant Center se pro rezervace fitness nepoužívá; místo něj Firemní profil na Googlu a konverze GA4 → Google Ads. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Odesílatel e-mailů NAVI**: ve Vercelu změnit `RESEND_FROM_EMAIL` na `NAVI Private Gym <noreply@…>`; pro odesílání z `@navigym.cz` nejdřív ověřit doménu v Resendu (DNS záznamy) a stejně upravit SMTP sender v Supabase Auth. Do té doby zůstává doména `namastegym.cz` s novým jménem odesílatele. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Předat administraci do st 9. 9.**: nechat správkyně zaregistrovat se na webu a v administraci → Členové jim přepnout roli na správce (tlačítko „Nastavit jako správce“). Zaškolit v Obsah webu, E-maily, Vstupné a věrnost (akce) a Nastavení (fotky, rozsah rezervací). `[imp:5]` `[owner:me]` `[time:45m]` `[kind:setup]`
- [ ] **Ilustrační fotografie**: vygenerovat kvalitní atmosférické snímky fitness (ne „naše prostory“) a nahrát je v administraci → Nastavení a branding: hero, fotka za sekcemi, čtyři dlaždice galerie a šest zón. Web u nich zobrazí štítek „Ilustrační foto“, dokud ho po dodání vlastních snímků nevypnete. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:content]`
- [ ] **Rozhodnout o fakturách**: (a) automatické potvrzení platby ze Stripe (zapnout v dashboardu, bez kódu), (b) Fakturoid přes integraci (účet, API klíč, fakturační údaje; 2–3 dny práce), (c) měsíční export pro účetní. Doporučeno (a) hned a (b) až po rozhodnutí. `[imp:3]` `[owner:me]` `[time:15m]` `[kind:decision]`
- [ ] **Nastavit říjnovou akci a rozsah rezervací**: v administraci → Vstupné a věrnost zadat akci 199 Kč od 1. 10. 2026 00:00 do 31. 10. 2026 23:59 a v Nastavení rozsah 130 dní (pokryje z října celý leden). Standardní cena 289 Kč platí automaticky mimo okno. Před 1. 10. udělat zkušební rezervaci. `[imp:5]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Nahradit neplatný klíč Google mapy**: produkce 15. 8. 2026 vrací `InvalidKeyMapError`; nasazená hodnota není Googlem rozpoznána jako API klíč. V Google Cloud → Credentials zkopírovat skutečnou hodnotu API key (obvykle začíná `AIza`), zapnout billing a Maps JavaScript API, nastavit HTTP referrery `https://namastegym.cz/*` a `https://www.namastegym.cz/*`, uložit ve Vercelu jako `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` pro Production a znovu nasadit. Volitelný vlastní Map ID patří samostatně do `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`. Do té doby web použije bezpečný Google embed se standardním markerem. `[imp:4]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Povolit synchronizaci Auth e-mailů z administrace**: vytvořit Supabase Personal Access Token, uložit ho ve Vercelu jako `SUPABASE_MANAGEMENT_API_TOKEN` pro Production a Preview a nasadit novou verzi. Poté administrace → E-maily propisuje šablony „Potvrzení registrace“ a „Obnova hesla“ do Supabase Auth. Přesný postup je v §7 [MANUAL_STEPS.md](./MANUAL_STEPS.md#7-supabase-auth-smtp--registrace-a-obnova-hesla). `[imp:5]` `[owner:me]` `[time:10m]` `[kind:setup]`
- [ ] **Ostrý test e-mailového workflow**: vytvořit novou testovací registraci, provést reset hesla a z administrace odeslat test všech pěti šablon. V Resend Logs ověřit doručení, český text, logo a sender. `[imp:5]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [x] **Text obchodních podmínek**: dodané VOP s účinností od 17. 8. 2026 jsou zveřejněné na `/obchodni-podminky` a propojené s rezervací i patičkou. `[imp:5]` `[owner:me]` `[time:1h]` `[kind:legal]`
- [ ] **Migrace 0007 v dalších prostředích**: `drizzle/0007_reservation_consents.sql` přidává do tabulky `reservation` sloupce `rules_accepted_at` a `terms_accepted_at`. Na nakonfigurované databázi je už aplikovaná; pokud existuje další prostředí (staging, druhý Supabase projekt), spustit ji i tam, jinak se rezervace neuloží. `[imp:5]` `[owner:me]` `[time:10m]` `[kind:deploy]`
- [ ] **Ostrý test rezervace bez registrace**: po zapojení Stripe live projít celý host checkout (vyplnit údaje, zaplatit, ověřit doručení potvrzení a přístupového kódu na e-mail i telefon zadaný ve formuláři) a zkontrolovat, že se v administraci rezervace zobrazuje bez účtu. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Fotografie jednotlivých zón**: dodat snímky pro dlaždice na `/vybaveni` (silová, kardio, strečink, dětský koutek, lednice, zázemí). Zatím se zobrazuje značková výplň se znakem NAVI, nebo ilustrační fotka, pokud ji nahrajete v administraci → Nastavení a branding. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:content]`
- [ ] **Značka české přírodní kosmetiky**: v textu kroku „Před odchodem“ byla v podkladu vynechaná („od značky …“). Dokud ji nedodáte, web uvádí jen „česká přírodní kosmetika“ bez názvu. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Stripe webhook**: zaregistrovat endpoint v Stripe Dashboardu (test i live), zkopírovat signing secret do `STRIPE_WEBHOOK_SECRET`. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Zernio (WhatsApp) provisioning**: propojit Meta účet, registrovat WABA, verifikovat phone number, nechat schválit template `access_code`. Poté vyžádat GO na rewrite `src/lib/integrations/whatsapp.ts` z Meta Graph na Zernio. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:setup]`
- [ ] **Nuki: fyzický zámek** (čeká na nákup): doplnit `NUKI_SMARTLOCK_ID`, vygenerovat `NUKI_WEBHOOK_SECRET`, fyzicky ověřit vytvoření/expiraci/revokaci kódu. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **Přihlášení přes Google v Safari**: klientka hlásí, že se přesměrování nedokončí. Kód už chybu nezametá — nepovedený návrat končí na `/login` s českou hláškou. Zbývá ověřit v Supabase → Authentication → URL Configuration, že `Site URL` i `Redirect URLs` obsahují **přesně tu doménu, na které web běží**, včetně varianty s `www` i bez ní, a že sedí s `NEXT_PUBLIC_APP_URL` ve Vercelu. Nesoulad hostitelů je nejčastější příčina: cookie s PKCE ověřovatelem se pak s návratem nepošle. Po úpravě zkusit přihlášení v Safari znovu a poslat případnou hlášku. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Navazující nastavení vlastní domény**: veřejný web již běží na vlastní doméně. Před ostrým provozem ještě potvrdit `NEXT_PUBLIC_APP_URL`, `Site URL` v Supabase, Stripe webhook URL a Nuki webhook URL. `[imp:4]` `[owner:me]` `[time:30m]` `[kind:setup]`
- [ ] **Ostrý test přílohy kalendáře**: po zapojení Resend v ostrém provozu ověřit, že potvrzovací e-mail nese přílohu `rezervace.ics` a že se termín správně naimportuje do Google i Apple kalendáře (letní i zimní čas). `[imp:3]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Posoudit variantu „Moderní“ a rozhodnout o výchozím vzhledu**: otevřít `namastegym.cz/dev` (tím se přepínač odemkne jen ve vašem prohlížeči, návštěvníci ho nevidí) a projít úvodní stránku, Vybavení a účet v obou podobách. Po rozhodnutí nastavíme vybranou podobu jako výchozí a přepínač i stránku `/dev` odstraníme. `[imp:3]` `[owner:me]` `[time:20m]` `[kind:decision]`
- [ ] **Smazat sloučené větve na GitHubu**: `claude/navi-rebrand` a `claude/mobbing-feature-ideas-kens00` jsou plně v `main`, ale mazání větví z tohoto prostředí neprojde přes proxy (běžný push funguje). Smazat je v GitHubu → Branches. Ostatní větve (`gym-plzen-hero-calendar-rgq7fl`, `gym-website-booking-plan-8u4t2n`, `needed-md-reorganize-vd0trv`, `preview-no-login-design-6lr2vm`, `codex/production-readiness-audit`) sloučené nejsou — nejdřív ověřit, jestli v nich něco nezůstalo. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:deploy]`
- [ ] **Aktualizovat Next.js kvůli postcss**: `npm audit --omit=dev` hlásí poslední dvě zranitelnosti (`postcss` ≤ 8.5.22) přes verzi Next.js. Ostatní byly opraveny; tato vyžaduje `next@16.3.4`, tedy hlavní verzi. Týká se sestavení, ne běhu webu u návštěvníků. Naplánovat samostatně s plným regresním testem. `[imp:2]` `[owner:ai]` `[time:2h]` `[kind:deploy]`
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
