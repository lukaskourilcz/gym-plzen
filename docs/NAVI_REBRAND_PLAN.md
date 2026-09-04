# Plán: rebrand na NAVI, říjnová akce a předání webu

Aktualizováno: 4. 9. 2026. Podklad: zpráva klienta ze 4. 9. 2026 (nový název
NAVI Private Gym, nové logo, říjnová akce 199 Kč, standardní cena 289 Kč od
listopadu, fotografie, přístup do administrace, faktury, deadline 11. 9.).

## Co klient chce a co to znamená v kódu

| #   | Požadavek klienta                                       | Stav v kódu dnes                                                                                                                         | Práce                                                                      |
| --- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1   | Říjen: 199 Kč, každá 10. zdarma, i na pozdější termíny  | Jedna cena (`pricing.entry_price_cents`, default 290 Kč); věrnost 10. vstup zdarma existuje, jen pro přihlášené; horizont 60 dní napevno | Akční okno podle data rezervace, horizont nastavitelný, admin UI           |
| 2   | Od listopadu 289 Kč                                     | Default 29 000 hal. v kódu, „290 Kč“ v FAQ, testech a dokumentaci                                                                        | Změna defaultu + texty přes `{price}` placeholder                          |
| 3   | Název NAVI + nové logo všude                            | 189 výskytů „Namasté“ v kódu, e-mailech, ICS, Stripe, JSON-LD, docs; lotos ve 12 komponentách; hardcoded `namastegym.cz`                 | Systematický rebrand + výměna assetů + URL z env                           |
| 3b  | info@navigym.cz, GA4, Merchant Center, Meta, WhatsApp   | GA4 a Meta Pixel ID jsou **natvrdo v kódu**; kontaktní e-mail je CMS default; WhatsApp čeká na Zernio                                    | ID do env; kontakt do CMS; Merchant Center nedává smysl (viz odpověď)      |
| 4   | Ilustrační fotografie do doby vlastních                 | Hero a fotka za sekcemi jsou v administraci; galerie a zóny nemají obrázkové klíče                                                       | Klíče + upload pro galerii a zóny, štítek „ilustrační foto“                |
| 5   | Přístup do administrace                                 | Role se nastavuje jen skriptem `set-admin`                                                                                               | Správa rolí v administraci → Členové                                       |
| 6   | Kontrola propsání, náhled e-mailů, faktury              | Náhled i test e-mailů existuje; faktury systém negeneruje                                                                                | Průřezový test rebrandu; faktury = rozhodnutí (Stripe účtenky / Fakturoid) |
| 7   | Deadline pátek 11. 9.                                   | —                                                                                                                                        | Harmonogram níže                                                           |
| +   | Větší text v kalendáři, menší mezera, tlačítko na střed | `booking-calendar.tsx`, sekce `#jak-to-funguje`/`#cenik`, pás `#pridej-se`                                                               | Drobné úpravy                                                              |

## Zjištěné skutečnosti, které ovlivňují plán

- **Analytika je natvrdo v kódu.** `src/lib/config/analytics.ts` obsahuje GA4
  `G-6L9N41NKT8` a Meta Pixel `1816423579552231`. Přechod na NAVI účty musí
  jít přes env proměnné, jinak každá změna znamená nasazení.
- **Právní texty jsou klientovy.** VOP (`src/lib/content/terms.ts`) a provozní
  řád (`rules.ts`) uvádějí `www.namastegym.cz` a `info@namastegym.cz`. Nejde je
  jen přepsat strojově: klient musí dodat aktualizované znění (název, doména,
  e-mail, případně nový subjekt).
- **Doména je otevřená otázka.** Nový e-mail `info@navigym.cz` naznačuje novou
  doménu. Stěhování webu = DNS, ověření domény v Resendu, Supabase URL, Stripe
  a Nuki webhooky, přesměrování ze staré domény. Kód musí mít všechny absolutní
  URL z `NEXT_PUBLIC_APP_URL`, ať už se stěhuje, nebo ne.
- **Cena není v administraci tam, kde by ji hledali.** Přepisuje se v
  Členství (`/admin/memberships`), ne v Nastavení. Akční okno přidáme vedle ní a
  odkážeme z Nastavení.
- **Věrnost je jen pro registrované.** Rezervace bez účtu se nepočítají;
  klient to musí vědět a komunikovat.
- **Loga zatím není vektor.** Dodaný obrázek je 3D vizualizace (zlatá na
  zelené). Na web potřebujeme SVG/PNG s průhledným pozadím: samotný znak
  (kettlebell s N), wordmark a celý lockup, zlatá i jednobarevná verze, plus
  variantu pro světlé pozadí e-mailu.
- **Fotky nevygeneruje kód.** Ilustrační snímky vytvoří Lukáš nástrojem pro
  generování obrázků; kód zajistí, aby šly nahrát a byly označené.

## Pracovní balíčky

### A. Rebrand textů na NAVI Private Gym

Defaulty CMS (`brand.name`, hero `titleAccent` „Namasté.“ → „NAVI.“, FAQ,
kroky), `metadata` v layoutu, JSON-LD, e-mailové šablony (subjekty a podpisy),
HTML hlavička e-mailu, Stripe popis položky („Jednorázový vstup | …“), ICS
`SUMMARY`/`PRODID`, admin shell, seed, testy a dokumentace (README,
about-project, monetization, scaling, DESIGN_SYSTEM, SESSION_HANDOFF). Jednorázový
skript `scripts/rebrand-navi.ts` přepíše existující řádky `content_block` a
uložené e-mailové šablony v `site_setting` (jen známé fráze, idempotentně) a
administrace → E-maily se po nasazení znovu synchronizuje do Supabase Auth.
Interní demo účty `@namaste.demo` a názvy cookies zůstávají (zákazník je
nevidí, přejmenování by jen rozbilo testy a dokumentaci).

Test: unit test projde `SITE_DEFAULTS`, fallbacky šablon, ICS a Stripe popis a
selže na `/namast/i`; e2e ověří vykreslené stránky a náhledy e-mailů.

### B. Nové logo a znak místo lotosu

`LotusMark` → `BrandMark` (znak kettlebell-N), `BrandLogo` (znak + wordmark
v hlavičce, ~180 px), `BrandLockup` (login, patička), favicon `src/app/icon.png`
ze znaku ve zlaté na ink, e-mailový log (absolutní URL z env, verze pro světlé
pozadí), FAQ crossfade znak ↔ otazník, věrnostní vodoznak, výplň zón, mapový
marker (nová maska + nové kotvení špičky) a `/admin/design-system`. Sekce
„Logo system“ v `docs/DESIGN_SYSTEM.md` se přepíše pro nový znak (minimum
32 px, ochranná zóna, zlatá na ink, zelená na světlé, nikdy na fotce bez
podkladu). Do dodání vektoru poslouží ořez z dodané vizualizace jako dočasný
raster, ale finální assety jsou od klienta.

### C. Absolutní URL a kontakty z konfigurace

Odkazy v e-mailech (`/login`, `/reset-password`), URL loga v e-mailu, doména v
ICS `UID`, `mailto` na stránce ochrany soukromí a náhled v administraci berou
hodnotu z `NEXT_PUBLIC_APP_URL` a z CMS `contact.email` (default
`info@navigym.cz`). Připravit `MANUAL_STEPS.md` §10 „Změna domény“ (Vercel,
DNS, Resend, Supabase, Stripe, Nuki, `NEXT_PUBLIC_APP_URL`, 301 ze staré
domény, Search Console, GA4 stream) a volitelné přesměrování hostu v
`next.config`, pokud se web stěhuje.

### D. Cena 289 Kč a říjnová akce 199 Kč

- Default `DEFAULT_ENTRY_PRICE_CENTS` = 28 900; všechny texty s cenou používají
  `{price}` placeholder (FAQ, kroky, ceník), aby číslo nikdy nezastaralo.
- Akční okno v `site_setting`: `pricing.promo.price_cents`,
  `pricing.promo.starts_at`, `pricing.promo.ends_at` (Europe/Prague).
  **Rozhoduje čas vytvoření rezervace, ne termín**: kdo rezervuje v říjnu,
  platí 199 Kč i za leden. `getEntryPriceCents(at)` vrací akční cenu uvnitř
  okna, jinak standardní; `priceForNextEntry` tím pádem respektuje akci a 10.
  vstup zůstává zdarma.
- Veřejný web: cena na hero, ve faktech, v ceníku i v kartě dostupnosti se
  řídí stejnou funkcí; během akce se zobrazí i standardní cena a admin
  editovatelná věta („Akce do 31. 10.: 199 Kč platí i pro termíny v dalších
  měsících“). ISR 60 s zajistí přepnutí do minuty od půlnoci.
- Administrace: pole akce vedle ceny vstupu (Členství) s validací (Zod, konec
  po začátku, cena > 0) a indikátorem „Právě platí“.
- Změna termínu cenu nemění (rescheduling ji nepřepočítává, ověřit testem).

### E. Horizont rezervací nastavitelný

`BOOKING_HORIZON_DAYS` (60) → `site_setting` `booking.horizon_days` s defaultem
60 a validací 7–365, čtené jednou službou (`slots`, `/rezervace`,
`/rezervace/udaje`). Pole v administraci → Nastavení vedle náhledu dní. Pro
akci doporučeno 130 dní (1. 10. → konec ledna = 123). Ověřit výkon dotazu na
dostupnost při delším rozsahu a navigaci kalendáře po měsících.

### F. Drobné úpravy z e-mailu

- Kalendář: dny `text-base sm:text-lg` → `text-lg sm:text-xl`, hlavička dnů
  `text-[11px]` → `text-xs`, sloty a legenda `text-xs` → `text-sm`; ověřit
  320 px se sedmi sloupci a 44 px cíle.
- Menší mezera mezi „Jak to funguje“ a „Ceník“: spodní padding první a horní
  druhé sekce zmenšit (např. `pb-8 lg:pb-10` / `pt-8 lg:pt-10`), fotografie za
  sekcemi zůstává přišpendlená.
- Pás „Připravený na změnu“: tlačítko na mobilu na střed
  (`justify-self-center lg:justify-self-end`), text zůstává vlevo dle
  schváleného layoutu.

### G. Ilustrační fotografie

Nové CMS klíče a upload (existující `media.uploadAsset`) pro galerii na úvodní
stránce (`home.gallery.image1–4`) a šest zón na `/vybaveni`; hero a fotka za
sekcemi už v administraci jsou. Ke každému ilustračnímu snímku drobný štítek
„Ilustrační foto“ a alt text, který netvrdí, že jde o prostor NAVI. Do
`docs/DESIGN_SYSTEM.md` (Photography) doplnit výjimku: označené ilustrační
snímky jsou přípustné do dodání vlastní fotografie. Samotné snímky dodá Lukáš.

### H. Správa rolí v administraci

V Členové akce „Nastavit jako správce“ / „Odebrat správce“ (server action,
`assertAdmin`, Zod, služba `members.setRole`), pojistka proti odebrání
posledního správce, záznam do logu. Předání administrace pak nevyžaduje
skript.

### J. Faktury (rozhodnutí)

Systém doklady negeneruje. Varianty: (a) automatické potvrzení platby ze
Stripe (nastavení v dashboardu, `locale: "cs"` v Checkoutu, bez kódu),
(b) integrace Fakturoid přes adaptér (`integrations/fakturoid.ts`), vystavení
dokladu v kroku `payment` pipeline, odkaz v potvrzení, přehled v administraci;
vyžaduje účet, API klíč a fakturační údaje (IČO, DIČ, režim DPH), odhad 2–3
dny, (c) měsíční CSV export z administrace pro účetní. Doporučení: (a) hned,
(c) levně, (b) až po rozhodnutí.

### K. Analytika a marketing přes env

`NEXT_PUBLIC_GA_MEASUREMENT_ID` a `NEXT_PUBLIC_META_PIXEL_ID` místo konstant;
bez hodnoty se měření nenačte (consent manager už s absencí počítá). Přidat do
`env.ts`, `.env.example`, `NEEDED.md`. Google Merchant Center je pro e-shopy s
produkty; pro rezervace fitness nemá využití. Náhradou je Firemní profil na
Googlu a konverze GA4 → Google Ads. WhatsApp pokračuje dle NEEDED (Zernio).

### M. Průřezové ověření a předání

Test rebrandu (žádné „Namasté“ v zákaznickém výstupu), testy cen (před oknem,
v okně, po okně, 10. vstup v okně zdarma, změna termínu bez přepočtu),
horizont, obě varianty vzhledu, e-maily (náhled + testovací odeslání),
Playwright veřejný + demo, `format:check`/`lint`/`typecheck`/`test`/`build`,
aktualizace `SESSION_HANDOFF.md`, `README.md`, `about-project.md`,
`MANUAL_STEPS.md` §10, `NEEDED.md`; kontrolní seznam pro předání 11. 9.

## Co potřebujeme od klienta (a do kdy)

| Do       | Položka                                                                                                          |
| -------- | ---------------------------------------------------------------------------------------------------------------- |
| po 7. 9. | Logo ve vektoru: znak, wordmark, lockup; zlatá + jednobarevná; verze na světlé pozadí                            |
| po 7. 9. | Rozhodnutí o doméně (zůstat na namastegym.cz, nebo stěhovat na navigym.cz) a přístup k DNS, pokud stěhovat       |
| po 7. 9. | Potvrzení hero textu („Tvůj čas. Tvůj prostor. Tvoje NAVI.“) a případné textové změny v Obsah webu               |
| út 8. 9. | Aktualizované VOP a provozní řád s novým názvem, doménou a e-mailem                                              |
| út 8. 9. | GA4 Measurement ID (nová property NAVI, nebo přístup ke stávající), Meta Pixel ID / přístup do Business Manageru |
| út 8. 9. | E-maily, pod kterými se zaregistrují správkyně (pro roli správce)                                                |
| út 8. 9. | Rozhodnutí o fakturách (Stripe účtenky / Fakturoid / export)                                                     |
| st 9. 9. | Fakturační údaje pro Stripe účtenky (název, IČO, adresa)                                                         |

## Harmonogram do 11. 9.

| Den       | Práce                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| pá 4. 9.  | Plán, issues, odpověď klientovi; start A, C, D, E, F, K (nezávislé na podkladech)            |
| po 7. 9.  | A, C, D, E, F, K hotové a nasazené; B s dočasným rasterem; G (klíče + upload)                |
| út 8. 9.  | B s finálním vektorem; H; ilustrační fotky nahrané; VOP a provozní řád vyměněné              |
| st 9. 9.  | Předání administrace (role správce), zaškolení v Obsah webu a E-maily; M (průřezové ověření) |
| čt 10. 9. | Rezerva na opravy; testovací e-maily a rezervace nanečisto                                   |
| pá 11. 9. | Společný test na místě, předání                                                              |

Mimo naši kontrolu a proto mimo termín: schválení WhatsApp šablony Metou,
propagace DNS při stěhování domény, případná integrace Fakturoidu (po
rozhodnutí).

## GitHub issues

Doplní se po založení.

## Kickoff prompt pro implementaci

Doplní se po založení issues (viz níže).
