# UX audit: NAMASTÉ Private Gym

Datum prvního průchodu: 23. 7. 2026  
Auditovaný commit: `4c3fdf3`  
Stav dokumentu: první průchod před remediation

## 1. Executive verdict

**CONDITIONAL GO pro prezentaci klientovi. NO-GO pro ostrý provoz.**

Rozhraní už nepůsobí jako generická AI šablona. Veřejný web má jasnou značku,
dobrou hierarchii, skutečnou fotografii, střídmý počet CTA a srozumitelný
date-first rezervační tok. Na šířkách 320 až 1728 px nebyl zjištěn horizontální
overflow. Klávesnicový výběr data, viditelný focus a reduced-motion režim prošly.

Klientská ukázka je vhodná, pokud je výslovně prezentována jako funkční MVP s
ilustrační dostupností a ilustračními daty. Produkční spuštění je zablokované
chybějícím správným Supabase projektem, právními texty a neověřenými externími
službami. Před prezentací doporučuji opravit P1 nálezy, zejména mobilní admin
navigaci, neaktivní OAuth volby a obnovu rezervací po chybě.

### Rozsah a důkazy

- Skutečná aplikace byla testována přes Chromium a Playwright na lokálním
  preview `http://127.0.0.1:3000`.
- Produkční bezpečný stav bez databáze byl ověřen na čistém Node 22 buildu na
  `http://127.0.0.1:3131`. Rezervace správně nezobrazuje fiktivní dostupnost.
- Prošly E2E scénáře veřejného webu, lokálního klientského účtu a lokální
  administrace: **9/9**.
- Viewporty: 320, 390, 667 landscape, 768, 1024, 1280, 1440 a 1728 px.
- Reflow byl navíc ověřen na 640 CSS px jako ekvivalent 200% přiblížení
  1280px viewportu. Doslovné ovládání zoomu prohlížeče nebylo v této session
  dostupné, proto je tato část označená jako částečně ověřená.
- Vestavěný prohlížeč Codex nebyl v session dostupný. Všechny níže uvedené
  vizuální a interakční důkazy proto pocházejí z lokálního Playwright Chromium,
  screenshotů a kontroly vykresleného DOM. Tento limit nesnižuje platnost E2E
  výsledků, ale je uveden kvůli dohledatelnosti.

## 2. Scorecard

| Oblast                       |                    Skóre | Verdikt                                                                        |
| ---------------------------- | -----------------------: | ------------------------------------------------------------------------------ |
| Vizuální hierarchie a značka |                     8/10 | Klidná, konzistentní a výrazně méně generická                                  |
| Obsah a srozumitelnost       |                     7/10 | Hlavní nabídka je jasná, několik textů je vágních nebo předčasných             |
| Rezervační funnel            | 7/10 demo, 2/10 produkce | Date-first UI funguje, ostré služby nejsou připojené                           |
| Responsive UX                |                     8/10 | Bez overflow, slabší mobilní admin navigace                                    |
| Přístupnost                  |                     7/10 | Focus, kalendář a reduced motion jsou dobré, několik navigačních mezer zůstává |
| Důvěryhodnost                |                     6/10 | Transparentní preview stav je výborný, právní a kontaktní obsah chybí          |
| Klientský účet               |                     7/10 | Přehledný, ale opakuje začátek času a odchyluje se od design systému           |
| Administrace                 |                     6/10 | Desktop je použitelný, mobilní orientace a demo data potřebují úpravu          |
| Design-system compliance     |                     7/10 | Většina veřejného webu odpovídá, účet a referenční stránka mají odchylky       |

## 3. Strengths

1. Hero okamžitě vysvětluje hodnotu, cenu i umístění. Primární CTA je jasné a
   sekundární CTA nepřebíjí hlavní akci.
2. Logo systém je správně rozdělený: symbol v headeru, plný podpis ve footeru,
   loginu a administraci.
3. Skutečná fotografie z klientského webu je použita přes `next/image` a
   neověřené fotografie jsou nahrazené poctivými strukturálními placeholdery.
4. Hero dostupnost rozlišuje live, ilustrační a nedostupný stav. Produkce bez DB
   nevydává preview za skutečné termíny.
5. Měsíční kalendář je date-first, pondělí je první den a datum má popsané
   dostupné, minulé, vybrané a zakázané stavy.
6. Sloty uvádějí přesný začátek, konec, délku a cenu. Klávesnicová volba data v
   Playwright E2E prošla.
7. Na všech požadovaných šířkách je stránka bez horizontálního overflow.
8. Focus je při tabování viditelný jako 3px outline. Reduced motion test prošel.
9. Chybové, prázdné a preview stavy používají text i ikonu, ne pouze barvu.
10. Právní placeholdery a demo banner otevřeně přiznávají, co ještě není hotové.

## 4. Klientská matice

| Oblast ukázky        | Co klient uvidí                                              | Riziko při ukázce                                  | Verdikt             |
| -------------------- | ------------------------------------------------------------ | -------------------------------------------------- | ------------------- |
| Úvodní stránka       | Hotový hero, cena, princip, prostor, pravidla, adresa a mapa | Galerie je zčásti placeholder                      | GO                  |
| Hero dostupnost      | Přepínání dnů a přesné rozsahy                               | Musí zůstat označeno jako ukázka                   | GO                  |
| Rezervace            | Funkční měsíční kalendář a volba slotu                       | Bez ostré DB pouze ilustrační data                 | GO s vysvětlením    |
| Přihlášení           | Lokální admin a klientský demo účet                          | OAuth tlačítka mohou být bez služby tichá          | CONDITIONAL GO      |
| Klientský účet       | Věrnost a nadcházející rezervace                             | Duplicitní čas v řádku snižuje čistotu             | GO po drobné opravě |
| Administrace desktop | Dashboard, obsah, provozní moduly, plán a inspirace          | Cizojazyčná vzdálená demo data působí šablonově    | CONDITIONAL GO      |
| Administrace mobil   | Funkční dashboard                                            | Dlouhá horizontální navigace nemá jasnou orientaci | CONDITIONAL GO      |
| Právní stránky       | Transparentní placeholder                                    | Nejde o použitelné právní dokumenty                | Jen demo            |
| Produkční rezervace  | Bez falešné dostupnosti                                      | Celý funnel je bez správného backendu zablokovaný  | NO-GO               |

## 5. Findings P0 až P3

### P0: produkční blokátory

#### P0-01: Produkční rezervace, přihlášení, platba a vstup nejsou end-to-end připravené

- Typ: externě blokované, nikoli vizuální chyba.
- Důkaz: produkční `/rezervace` zobrazuje „Termíny teď nelze načíst“;
  `NEEDED.md` uvádí nepotvrzený Supabase projekt a chybějící Stripe, Nuki,
  Resend a WhatsApp konfiguraci.
- Dopad: uživatel nemůže dokončit hlavní úlohu produktu.
- Acceptance criteria:
  - je potvrzený samostatný Supabase projekt a aplikované migrace 0000 až 0003;
  - projde reálný test registrace, rezervace, platby, potvrzení, doručení a
    revokace vstupního kódu;
  - je ověřen souběh dvou pokusů o stejný slot a opakování webhooků;
  - produkce nikde nezobrazuje preview data.

#### P0-02: Právní texty nejsou připravené pro přijímání plateb

- Typ: externě blokované.
- Důkaz: `/obchodni-podminky` a `/ochrana-soukromi` obsahují pouze upozornění,
  že dokument čeká na schválení.
- Dopad: prezentace je možná, komerční spuštění ne.
- Acceptance criteria:
  - provozovatel nebo právník dodá schválené texty, identitu provozovatele,
    storno, privacy, retention a informace o platbě a přístupu;
  - stránky mají finální obsah, kontaktní subjekt a datum účinnosti;
  - cookies a analytics respektují výsledné privacy rozhodnutí.

### P1: vysoká priorita

#### P1-01: OAuth tlačítka mohou být viditelná, i když není dostupný Supabase klient

- Důkaz: `/login` vždy nabízí Google, Apple a Microsoft. `onOAuth()` při
  chybějícím klientu pouze provede `return` bez notice.
- Dopad: kliknutí nemá žádnou viditelnou reakci a v klientské ukázce vypadá jako
  rozbitá funkce.
- Acceptance criteria:
  - zobrazují se pouze skutečně povolení poskytovatelé;
  - při chybě inicializace nebo redirectu se objeví český `role="alert"`;
  - klávesnice, pending stav a opakované kliknutí jsou ošetřené.

#### P1-02: Mobilní administrace používá dlouhou horizontální navigaci bez orientačního prvku

- Důkaz: na 390 px jsou v jedné horizontální liště všechny administrační
  moduly; část dalších položek je mimo viewport a uživatel nevidí rozsah ani
  skupiny.
- Dopad: klient obtížně hledá obsah, nastavení, inspirace a plán spuštění.
- Acceptance criteria:
  - mobil má jeden jasný ovladač „Menu administrace“ nebo skupinový selector;
  - po otevření jsou všechny skupiny a aktivní položka čitelné bez horizontálního
    hledání;
  - Escape zavře menu, focus se vrátí na ovladač a aktuální route má
    `aria-current`.

#### P1-03: Nedostupná rezervace nemá přímou akci pro nové načtení

- Důkaz: stav říká „Obnovte stránku nebo to zkuste později“, ale nenabízí
  tlačítko. Uživatel musí znát browser reload.
- Dopad: dočasný výpadek vytváří slepý konec hlavního funnelu.
- Acceptance criteria:
  - notice obsahuje tlačítko „Zkusit znovu“;
  - během opakování je pending stav a opakovaná aktivace je blokovaná;
  - zvolené datum zůstane zachované;
  - po úspěchu je změna oznámena v `aria-live`.

#### P1-04: Web tvrdí podporu Apple Pay a Google Pay dříve, než je ověřená

- Důkaz: homepage a FAQ uvádějí Apple Pay a Google Pay jako podporované;
  `NEEDED.md` současně požaduje jejich zapnutí a ověření produkční domény.
- Dopad: předčasný slib snižuje důvěryhodnost a může být fakticky nesprávný.
- Acceptance criteria:
  - do produkce se publikuje pouze ověřená platební metoda;
  - seznam peněženek je řízený konfigurací nebo CMS;
  - do ověření copy zní pouze „Platba probíhá online kartou.“

#### P1-05: Kontaktní sekce nemá e-mail ani telefon

- Typ: externě blokované.
- Důkaz: `/` zobrazuje jen potvrzenou adresu. Kód e-mail a telefon správně
  skrývá, pokud nejsou potvrzené.
- Dopad: návštěvník nemá alternativní cestu při problému s rezervací nebo
  vstupem.
- Acceptance criteria:
  - provozovatel dodá a potvrdí e-mail a telefon;
  - údaje jsou klikatelné přes `mailto:` a `tel:` v kontaktu i footeru;
  - nejsou použity kontakty z Wix šablony.

#### P1-06: Provozní časy nejsou v repozitáři sjednocené

- Důkaz: výchozí konfigurace a admin uvádějí 06:00 až 22:00, launch plan uvádí
  05 až 21. Audit neurčuje, která varianta je skutečná.
- Dopad: klient může při prezentaci dostat protichůdnou informaci a výchozí sloty
  mohou být chybné.
- Acceptance criteria:
  - provozovatel písemně potvrdí časy pro každý den;
  - konfigurace, admin nápověda, seed a dokumentace používají stejný zdroj;
  - veřejný web časy nezobrazuje, dokud nejsou potvrzené.

### P2: střední priorita

#### P2-01: Klientský účet opakuje začátek termínu

- Důkaz: „24. 7. 2026 17:00 · 17:00–18:15“ a nad tím znovu
  „24. 7. 2026 17:00“ plus „17:00–18:15“.
- Dopad: řádky se na 390 px zbytečně lámou a informace působí neupraveně.
- Acceptance criteria: datum je uvedeno jednou a čas jednou, například
  „24. 7. 2026 · 17:00–18:15“.

#### P2-02: Demo admin používá vzdálená anglická jména z DummyJSON

- Důkaz: dashboard ukázal Olivia Wilson, Emma Miller, James Davis a další;
  data se načítají z `dummyjson.com`.
- Dopad: česká klientská prezentace působí jako generická šablona a je závislá
  na cizí službě.
- Acceptance criteria: demo používá lokální deterministická česká data,
  zůstává označeno jako „Ilustrační data“ a nevyžaduje síť.

#### P2-03: Veřejné mobilní menu nelze zavřít klávesou Escape

- Důkaz: po otevření menu a stisku Escape zůstalo `aria-expanded="true"`.
- Dopad: slabší ovládání klávesnicí a nesoulad s `docs/DESIGN_SYSTEM.md`.
- Acceptance criteria: Escape menu zavře, focus se vrátí na tlačítko a stav je
  oznámen přes správné `aria-expanded`.

#### P2-04: Chybí explicitní skip link a některé cíle jsou menší než interních 44 px

- Důkaz: první Tab vede na logo, ne na „Přeskočit na obsah“. Footer odkazy mají
  výšku přibližně 36 px, přepínač registrace 20 px. Focus samotný je viditelný.
- Dopad: více tabování a odchylka od interního accessibility standardu.
- Acceptance criteria:
  - první focusovatelný prvek je viditelný skip link do `<main>`;
  - samostatné ovladače mají nejméně 44 krát 44 px;
  - inline odkazy mají alespoň WCAG 2.5.8 prostorovou výjimku a nejsou těsně vedle
    jiného cíle.

#### P2-05: Klientský účet porušuje vlastní pravidla radii a dekorací

- Důkaz: účet a loyalty widget používají `rounded-[18px]`, `rounded-[14px]` a
  ornamentální radiální gradient. Design systém povoluje karty 10 px a
  dekorativní gradienty zakazuje.
- Dopad: účet působí jako jiný produkt než veřejný web.
- Acceptance criteria: účet používá `rounded-lg`, semantic surfaces a čistou
  tmavou plochu bez ornamentálního gradientu.

#### P2-06: Nadpis „Vybavení bez dohadů“ slibuje více, než stránka obsahuje

- Důkaz: samotná stránka říká, že přesný seznam bude teprve doplněn.
- Dopad: text působí reklamně a současně obrací pozornost k chybějícímu obsahu.
- Acceptance criteria: do dodání seznamu použít věcný nadpis „Vybavení a
  prostor“ a ponechat transparentní informaci o doplnění.

#### P2-07: Referenční design-system stránka obsahuje dvě `h1`

- Důkaz: `/admin/design-system` má `h1` „Design systém“ a ukázkový `h1`
  „Celý gym jen pro vás“.
- Dopad: referenční stránka sama nedodržuje pravidlo jednoho hlavního nadpisu.
- Acceptance criteria: ukázková typografie používá neutrální element se stylem
  H1 nebo je uzavřená v pojmenovaném demo regionu bez druhého dokumentového H1.

#### P2-08: Stav „Hotovo“ v plánu směšuje implementovaný kód s provozní připraveností

- Důkaz: řada integrací je označena hotová, ale jejich poznámka říká, že
  potřebují klíče; celkový progress je správně zastropovaný na 60 %.
- Dopad: klient může číst „Hotovo“ jako funkční v produkci.
- Acceptance criteria: rozlišit „Kód připraven“, „Ověřeno v testu“, „Ověřeno v
  provozu“ a zachovat celkové maximum 60 %, jak požaduje zadání.

### P3: nízká priorita

#### P3-01: Loading skeleton neudržuje strukturu konkrétní route

- Důkaz: globální skeleton má jeden univerzální blok. Při pomalejším admin nebo
  account loadu může uživatel krátce vidět layout, který neodpovídá výsledku.
- Acceptance criteria: kritické routes mají lehký layoutový skeleton se stejnou
  šířkou a hlavními bloky jako cílová stránka.

#### P3-02: Footer odkazy mají slabší vizuální důraz než zbytek navigace

- Důkaz: tmavý footer používá malé, tlumené odkazy a 36px řádek.
- Acceptance criteria: zvýšit textový kontrast a hit area bez změny klidné
  hierarchie footeru.

## 6. Page-by-page audit

| Route                  | Co funguje                                                                  | Co zbývá                                                                                                  |
| ---------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                    | Jasný hero, střídmé CTA, reálná fotka, cena, transparentní dostupnost, mapa | Doplnit ověřený kontakt, podmínit payment copy, lazy galerie při screenshotu zpočátku ukazuje placeholder |
| `/rezervace`           | Date-first kalendář, přesné časy, stavy, keyboard a 320px reflow            | Přidat „Zkusit znovu“ při výpadku a dokončit live backend                                                 |
| `/login`               | Čisté rozdělení loginu, labels, generic chyby, lokální demo funguje         | Skrýt neaktivní providery, přidat OAuth error, zvětšit přepínač režimu                                    |
| `/account`             | Věrnost, další trénink a rezervace jsou pochopitelné                        | Odstranit duplicitní čas, sjednotit radii a gradient                                                      |
| `/admin`               | Desktop shell je přehledný, data jsou označena jako ilustrační              | Přepracovat mobilní navigaci a lokální demo data                                                          |
| `/faq`                 | Dobré `details`, srozumitelná témata, FAQ schema                            | Podmínit neověřené peněženky, změnit generickou závěrečnou otázku                                         |
| `/vybaveni`            | Skutečná fotografie, poctivé přiznání chybějícího seznamu                   | Věcnější nadpis a finální seznam od provozovatele                                                         |
| Legal routes           | Správně `noindex`, transparentní blokace                                    | Nahradit schválenými dokumenty před produkcí                                                              |
| `/admin/design-system` | Užitečná živá galerie tokenů a stavů                                        | Odstranit druhý H1 a po remediation doplnit nové mobilní vzory                                            |
| Loading, empty, error  | Textové notices, ikony, `aria-live`, žádné raw provider chyby               | Route skeletony a přímé retry v rezervaci                                                                 |

## 7. Funnel audit

1. **Pochopení nabídky:** „Celý gym. Jen pro vás.“ spolu s adresou a cenou funguje.
2. **Kontrola dostupnosti:** hero widget ukazuje tři dny bez zahlcení a rozlišuje
   ukázkový stav.
3. **Volba data:** měsíční kalendář je běžný, pondělí první, minulost je vypnutá.
4. **Volba času:** exact range, délka a cena jsou správně v jednom rozhodovacím
   místě.
5. **Přihlášení:** e-mailový tok je srozumitelný, ale OAuth bez konfigurace může
   být slepý.
6. **Platba:** UI a serverové bezpečnostní guardy existují, end-to-end služba není
   externě ověřená.
7. **Potvrzení a účet:** success stavy nevěří query parametru a účet ukazuje
   termín. Copy času potřebuje zjednodušit.
8. **Vstup:** pokyny jsou v UI srozumitelné, fyzický zámek a doručení zůstávají
   externě blokované.

## 8. Přesné návrhy českého copy

| Místo                | Nyní                                                                               | Návrh                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Vybavení H1          | „Vybavení bez dohadů“                                                              | „Vybavení a prostor“                                                                |
| Login intro          | „Vítejte zpět. Přihlaste se a rezervujte.“                                         | „Přihlaste se ke svým rezervacím.“                                                  |
| FAQ CTA              | „Jste připraveni vybrat si čas?“                                                   | „Vyberte datum a volný čas.“                                                        |
| Rezervace error      | „Rezervační služba je dočasně nedostupná. Obnovte stránku nebo to zkuste později.“ | „Termíny se nepodařilo načíst. Zkuste načtení zopakovat.“ + tlačítko „Zkusit znovu“ |
| Účet, řádek          | „24. 7. 2026 17:00 · 17:00–18:15“                                                  | „24. 7. 2026 · 17:00–18:15“                                                         |
| Platba před ověřením | „Podporované jsou karty, Apple Pay a Google Pay.“                                  | „Platba probíhá online kartou.“                                                     |
| Admin demo           | cizojazyčná vzdálená jména                                                         | česká lokální ukázková jména, banner „Ilustrační data“ ponechat                     |

Texty nepoužívají em dash. En dash zůstává pouze ve správném zápisu časového
rozsahu.

## 9. Responsive a accessibility

### Potvrzeno

- 320, 390, 667 landscape, 768, 1024, 1280, 1440 a 1728 px bez horizontálního
  overflow na veřejných routes.
- 640px reflow bez overflow jako částečná kontrola 200% přiblížení.
- Mobile menu je ovladatelné tlačítkem a skryté položky nejsou před otevřením v
  tab orderu.
- Focus outline je 3px solid s 3px offsetem.
- Kalendář má role grid, row, columnheader, gridcell, `aria-current`,
  `aria-selected`, textové popisy dostupnosti a roving tabindex.
- Enter a šipky v kalendáři prošly E2E.
- Reduced motion nastavuje animace a transitions na 0.01ms; E2E prošel.
- Notices nekódují význam jen barvou.

### Mezery

- Escape nezavírá veřejné mobilní menu.
- Chybí explicitní skip link.
- Footer odkazy a login mode switch nedosahují interních 44 px.
- Mobilní admin spoléhá na horizontální posuv bez jasného affordance.
- Doslovný test browser zoomu 200 % a screen-reader poslech je potřeba udělat v
  ručním finálním QA.

## 10. Design-system compliance

### Odpovídá

- Manrope s českou sadou, semantic tokens, ink plochy a střídmá zelená.
- Symbol v headeru a plné logo v určených místech.
- Veřejné karty mají převážně `rounded-lg` nebo menší radius.
- Jeden hlavní CTA v každém rozhodovacím bloku.
- Lucide ikony, exact time ranges, české labels a transparentní preview stavy.
- Žádné glassmorphism, glow, dekorativní dashboardy ani nafouknuté marketingové
  sliby v hero.

### Neodpovídá

- Account používá 18px a 14px radii a ornamentální radiální gradient.
- `/admin/design-system` má dva H1.
- Veřejné menu nemá Escape close ani explicitní focus-return logiku.
- Některé samostatné cíle nedosahují interních 44 px.
- Nový mobilní admin navigační vzor není v živé galerii komponent.

## 11. Top 10 actions

1. Potvrdit správný Supabase projekt a dokončit ostrý end-to-end funnel.
2. Dodat a schválit právní dokumenty.
3. Nahradit mobilní admin lištu přístupným menu se skupinami.
4. Zobrazovat pouze nakonfigurované OAuth providery a přidat error feedback.
5. Přidat „Zkusit znovu“ do nedostupného stavu rezervací.
6. Odstranit neověřené Apple Pay a Google Pay copy do produkčního ověření.
7. Doplnit potvrzený e-mail a telefon bez použití Wix template kontaktů.
8. Opravit duplicitní čas, account radii a gradient.
9. Nahradit DummyJSON lokálními českými demo daty.
10. Doplnit skip link, Escape close, 44px targets a opravit druhý H1.

## 12. Acceptance checklist

### Před klientskou prezentací

- [x] Hero vysvětluje nabídku, cenu, lokalitu a další krok.
- [x] Preview dostupnost je jasně označená jako ukázková.
- [x] Lokální admin a klientský demo login funguje.
- [x] Veřejný web funguje na 320 až 1728 px bez horizontálního overflow.
- [x] Keyboard date selection a reduced motion E2E prošly.
- [ ] OAuth tlačítka nemohou skončit bez odezvy.
- [ ] Mobilní admin navigace má přehledný přístup ke všem modulům.
- [ ] Account nezobrazuje duplicitní čas.
- [ ] Demo admin nepoužívá vzdálená anglická data.

### Před produkčním spuštěním

- [ ] Je potvrzený správný Supabase projekt a aplikované migrace.
- [ ] Auth, RLS, rezervace a ochrana proti overlapu prošly testem.
- [ ] Stripe Checkout a webhooky prošly testem včetně retry a expiry.
- [ ] Nuki, e-mail a WhatsApp prošly fyzickým end-to-end testem.
- [ ] Obchodní podmínky a privacy jsou schválené.
- [ ] Kontaktní údaje a provozní časy jsou potvrzené.
- [ ] Payment copy odpovídá skutečně aktivním metodám.
- [ ] Neexistuje P0 ani P1 nález bez vlastníka a termínu.
- [ ] Proběhl ruční screen-reader a doslovný 200% browser zoom test.
- [ ] Finální UX reviewer zopakoval průchod a označil nálezy jako resolved,
      unresolved nebo externally blocked.

## 13. Stav nálezů

Tato tabulka bude aktualizována stejným reviewerem po remediation.

| Finding        | Stav po prvním průchodu |
| -------------- | ----------------------- |
| P0-01 až P0-02 | Externě blokované       |
| P1-01 až P1-06 | Otevřené                |
| P2-01 až P2-08 | Otevřené                |
| P3-01 až P3-02 | Otevřené                |
