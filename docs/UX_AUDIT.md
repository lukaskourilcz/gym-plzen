# UX audit: NAMASTÉ Private Gym

Datum prvního průchodu: 23. 7. 2026

Datum finálního průchodu: 30. 7. 2026

Aktualizace po klientské zpětné vazbě: 30. 7. 2026

Aktualizace značky a faviconu: 31. 7. 2026

Výchozí auditovaný commit: `4c3fdf3`

Remediation: `ea3e2e4`, `87692e0`, `d41507e`, `45aaa2f`

Stav dokumentu: finální nezávislé ověření po remediation

## 1. Executive verdict

**GO pro klientskou prezentaci. NO-GO pro ostrý provoz.**

Klientská ukázka je připravená jako funkční MVP. Veřejný web, rezervace s
ilustrační dostupností, lokální klientský účet a lokální administrace jsou
použitelné bez Supabase. Rozhraní má jasnou značku a hierarchii, střídmý počet
CTA, konzistentní české texty a nepůsobí jako generická AI šablona. Nebyl nalezen
nový P0 ani P1 kódový problém.

Ostré spuštění zůstává zablokované externími P0: chybí potvrzený produkční
backend a ověření celého řetězce rezervace, platby a vstupu, stejně jako
schválené právní dokumenty. Před produkcí je také potřeba dodat ověřené
kontaktní údaje.

### Aktualizace 30. 7. 2026

- Klient potvrdil provoz každý den 5:00–23:45, 75minutové sloty a lokalitu
  Plzeň - Roudná.
- Veřejný web používá dodané logo v horizontální navigační variantě, širší
  navigaci, viditelný informační pás, stejnoměrné vycentrované kroky, bílou
  cenovou kartu, horizontální závěrečnou výzvu a adresu nad mapou i v mapovém
  překryvu.
- Kontaktní údaje jsou pod nadpisem v pořadí adresa, e-mail a telefon, bez
  samostatné otevírací doby a bez svislých oddělovačů.
- Provozní kroky mají zlaté štítky 01–06 přímo před nadpisy; nadpisy a
  navazující text jsou zarovnané do společných řádků.
- Starý kreslený lotus byl ve všech sdílených výskytech nahrazen oficiální
  klientskou pětilistou značkou. FAQ zachovává stejnou otevírací animaci.
- Favicon používá přesný tvar z klientského souboru `namaste-lotus.png`, nikoli
  ručně nakreslenou aproximaci. Zlatá značka je na tmavě zeleném podkladu.
- Mapa používá čistý souřadnicový pohled bez automatické informační bubliny
  Googlu; zůstává pouze jedna vlastní kontaktní karta a lotusový marker.
- Závěrečný zelený CTA pás drží skupinu nadpisu a tlačítka uprostřed. Na
  desktopu je mezi nimi kontrolovaná mezera 80 px, na mobilu jsou ve sloupci.
- Pravá cenová karta má label „Jednorázový vstup“, cenu, délku a CTA. Neobsahuje
  text „Celý gym jen pro vás“, opakované věrnostní sdělení ani poznámku o
  registračních poplatcích.
- Společný kořenový layout udržuje footer u spodního okraje na krátkých
  veřejných stránkách a přirozeně za obsahem na stránkách delších.
- V lokálním vestavěném prohlížeči byly ověřeny šířky 320, 390, 768, 1024 a
  1440 px bez horizontálního přetékání. U provozních kroků se v každém řádku
  shoduje pozice nadpisů i začátků textu.
- Telefon a e-mail zůstávají layoutové placeholdery. FAQ nyní obsahuje dvacet
  klientem dodaných otázek a odpovědí.

### Finální důkazy

- Testována byla skutečná aplikace v lokálním Chromium na
  `http://127.0.0.1:3000`.
- Celý použitelný Playwright Chromium balík prošel: **10 passed, 0 failed**.
  Dalších 24 testů ostré administrace a autentizace bylo správně přeskočeno,
  protože vyžadují nakonfigurovaný Supabase projekt.
- Skip navigace prošla samostatným zátěžovým během **5/5** po sobě, včetně
  správného focusu po nahrazení streaming loading stavu.
- Ověřeny byly šířky 320, 390, 667 landscape, 768, 1024, 1280, 1440 a 1728 px.
  Veřejná část ani mobilní administrace neměly horizontální overflow.
- Na prověřených routes nebyly zaznamenány console chyby ani hydration chyby.
- Ověřeno bylo ovládání klávesnicí, Escape a návrat focusu u veřejného i admin
  menu, kalendář, reduced motion a jediný dokumentový H1.
- Reflow na 640 CSS px proběhl bez overflow jako praktický ekvivalent 200%
  přiblížení 1280px viewportu. Doslovný browser zoom a screen-reader poslech
  zůstávají součástí ručního předprodukčního QA.
- Vestavěný prohlížeč Codex nebyl v session dostupný. Vizuální kontrola proto
  proběhla přes lokální Playwright Chromium, screenshoty a vykreslený DOM.

## 2. Scorecard po remediation

| Oblast                       |                    Skóre | Verdikt                                                              |
| ---------------------------- | -----------------------: | -------------------------------------------------------------------- |
| Vizuální hierarchie a značka |                     8/10 | Klidná, konzistentní a rozpoznatelná                                 |
| Obsah a srozumitelnost       |                     8/10 | Věcné české copy bez předčasných platebních slibů                    |
| Rezervační funnel            | 8/10 demo, 2/10 produkce | Demo tok je jasný, ostré služby zůstávají externě blokované          |
| Responsive UX                |                     9/10 | Bez overflow, mobilní admin má přehledné skupinové menu              |
| Přístupnost                  |                     9/10 | Skip, focus, cíle, Escape, kalendář a reduced motion prošly          |
| Důvěryhodnost                |                     7/10 | Preview je transparentní, právní a kontaktní obsah čeká na klienta   |
| Klientský účet               |                     9/10 | Čisté termíny a konzistentní vizuální systém                         |
| Administrace                 |                     8/10 | Použitelná na mobilu, lokální česká demo data, jasná aktivní položka |
| Design-system compliance     |                    10/10 | Bez zjištěné interní odchylky                                        |

## 3. Strengths

1. Hero okamžitě vysvětluje hodnotu, cenu, místo i hlavní další krok.
2. Tři dny dostupnosti v hero dávají rychlý přehled bez zahlcení.
3. Rezervace používá date-first kalendář, přesné rozsahy času a čitelné stavy.
4. Produkce bez databáze nevydává preview data za skutečnou dostupnost a nabízí
   přímou akci „Zkusit znovu“.
5. Lokální demo přihlášení pro klienta i administrátora funguje bez Supabase.
6. Mobilní administrace seskupuje moduly a správně řeší aktivní route, Escape i
   návrat focusu.
7. Demo administrace používá lokální deterministická česká data bez závislosti
   na vzdálené službě.
8. Veřejné stránky fungují od 320 do 1728 px bez horizontálního overflow.
9. Skip navigace, viditelný focus, klávesnicový kalendář a reduced motion mají
   automatizované regresní pokrytí.
10. Právní placeholdery, preview dostupnost a ilustrační admin data poctivě
    komunikují svůj neprodukční stav.

## 4. Klientská matice

| Oblast ukázky       | Co klient uvidí                                              | Podmínka prezentace                               | Verdikt  |
| ------------------- | ------------------------------------------------------------ | ------------------------------------------------- | -------- |
| Úvodní stránka      | Hotový hero, cena, princip, prostor, pravidla, adresa a mapa | Galerie je dočasně zčásti placeholder             | GO       |
| Hero dostupnost     | Tři nejbližší dny a přesné rozsahy                           | Ukázkový stav musí zůstat označený                | GO       |
| Rezervace           | Funkční kalendář, sloty a retry stav                         | Bez ostré DB jde o ilustrační data                | GO       |
| Přihlášení          | Lokální admin a klientský demo účet                          | OAuth se zobrazí jen po konfiguraci               | GO       |
| Klientský účet      | Věrnost a nadcházející rezervace                             | Demo data jsou ilustrační                         | GO       |
| Administrace        | Přehled, obsah, provozní moduly, plán a inspirace            | Produkční zápisy vyžadují Supabase                | GO       |
| Právní stránky      | Transparentní placeholder                                    | Nejde o použitelné právní dokumenty               | Jen demo |
| Produkční rezervace | Bez falešné dostupnosti                                      | Backend, platba a vstup nejsou end-to-end ověřené | NO-GO    |

## 5. Stav nálezů P0 až P3

### P0: produkční blokátory

#### P0-01: Produkční rezervace, přihlášení, platba a vstup nejsou end-to-end připravené

- Stav: **EXTERNALLY BLOCKED**
- Kód bezpečně podporuje demo a bez databáze nezobrazuje falešnou ostrou
  dostupnost. Produkční tok ale nelze označit za hotový bez potvrzeného Supabase
  projektu, migrací a reálných integrací Stripe, Nuki a doručovacích kanálů.
- Uzavření vyžaduje reálný test registrace, rezervace, platby, potvrzení,
  doručení a revokace vstupního kódu, včetně souběhu slotů a opakovaných
  webhooků.

#### P0-02: Právní texty nejsou připravené pro přijímání plateb

- Stav: **EXTERNALLY BLOCKED**
- `/obchodni-podminky` a `/ochrana-soukromi` správně přiznávají, že dokumenty
  čekají na schválení. To je vhodné pro demo, ne pro komerční spuštění.
- Uzavření vyžaduje schválené texty, identitu provozovatele, storno pravidla,
  privacy a retention pravidla, kontaktní subjekt a datum účinnosti.

### P1: vysoká priorita

#### P1-01: OAuth tlačítka mohou být viditelná, i když není dostupný Supabase klient

- Stav: **RESOLVED**
- Poskytovatelé se zobrazují pouze podle `NEXT_PUBLIC_OAUTH_PROVIDERS`. Výchozí
  lokální demo žádná neaktivní tlačítka neukazuje. Chyby mají český alert a
  obsluha má pending stav.

#### P1-02: Mobilní administrace používá dlouhou horizontální navigaci bez orientačního prvku

- Stav: **RESOLVED**
- Mobilní administrace má jeden ovladač, skupiny Provoz, Lidé, Obsah a Systém,
  viditelnou aktuální route a přehled všech položek bez horizontálního hledání.
  Escape menu zavře a focus se vrátí na ovladač.

#### P1-03: Nedostupná rezervace nemá přímou akci pro nové načtení

- Stav: **RESOLVED**
- Chybový stav nabízí „Zkusit znovu“, blokuje opakovanou aktivaci během pending
  stavu a obnovuje route bez nutnosti browser reloadu.

#### P1-04: Web tvrdí podporu Apple Pay a Google Pay dříve, než je ověřená

- Stav: **RESOLVED**
- Klientské FAQ uvádí platbu kartou, Google Pay a Apple Pay. Integrace používá
  hostovaný Stripe Checkout; zobrazení peněženek závisí na podporovaném zařízení
  a ostrém nastavení. Před spuštěním proto zůstává povinný test obou metod na
  cílové doméně.

#### P1-05: Kontaktní údaje nejsou potvrzené

- Stav: **EXTERNALLY BLOCKED**
- Aplikace používá potvrzenou adresu a kontakt i patička mají klikatelné
  `mailto:` a `tel:` odkazy. Hodnoty `info@namastegym.cz` a `777 666 555` jsou
  ale stále výslovné placeholdery. Klient musí dodat skutečný e-mail a telefon.

#### P1-06: Provozní časy nejsou v repozitáři sjednocené

- Stav: **RESOLVED**
- Klient potvrdil provoz 5:00–23:45 každý den. Konfigurace, veřejný web,
  rezervační karta a dokumentace používají společný výchozí rozvrh a
  75minutová okna.

### P2: střední priorita

#### P2-01: Klientský účet opakuje začátek termínu

- Stav: **RESOLVED**
- Termíny používají jeden zápis data a času, například
  „24. 7. 2026 · 17:00–18:15“.

#### P2-02: Demo admin používá vzdálená anglická jména z DummyJSON

- Stav: **RESOLVED**
- Data jsou lokální, deterministická a česká. Demo už nepotřebuje síťovou
  službu třetí strany.

#### P2-03: Veřejné mobilní menu nelze zavřít klávesou Escape

- Stav: **RESOLVED**
- Escape menu zavře, aktualizuje `aria-expanded` a vrátí focus na ovladač.

#### P2-04: Chybí explicitní skip link a některé cíle jsou menší než interních 44 px

- Stav: **RESOLVED**
- Skip link je první klávesnicový cíl, přeskočí na právě vykreslené `<main>` a
  prošel 5/5 opakovaných testů během streamingu. Footer odkazy, přepínač režimu
  loginu i samostatný mobilní odkaz „← NAMASTÉ Private Gym“ mají nejméně 44px
  hit area.
- Mobilní odkaz na loginu byl nezávisle ověřen na 390 px třemi opakovanými
  Playwright běhy s přímou kontrolou bounding boxu: **3/3 passed**.

#### P2-05: Klientský účet porušuje vlastní pravidla radii a dekorací

- Stav: **RESOLVED**
- Účet používá `rounded-lg`, sémantické plochy a čisté tmavé pozadí bez
  ornamentálního radiálního gradientu.

#### P2-06: Nadpis „Vybavení bez dohadů“ slibuje více, než stránka obsahuje

- Stav: **RESOLVED**
- Stránka používá věcný nadpis „Vybavení a prostor“ a transparentní informaci o
  budoucím doplnění seznamu.

#### P2-07: Referenční design-system stránka obsahuje dvě `h1`

- Stav: **RESOLVED**
- `/admin/design-system` má jediný dokumentový H1. Ukázka hero typografie už
  nevytváří druhý hlavní nadpis.

#### P2-08: Stav „Hotovo“ v plánu směšuje implementovaný kód s provozní připraveností

- Stav: **RESOLVED**
- Plán rozlišuje „Kód připraven“ a „Ověřuje se“. Celková připravenost zůstává
  zastropovaná na 60 %, dokud neproběhne produkční ověření.

### P3: nízká priorita

#### P3-01: Loading skeleton neudržuje strukturu konkrétní route

- Stav: **UNRESOLVED**
- Obecný skeleton je funkční a po opravě už nekoliduje se skip cílem, ale stále
  nereprezentuje hlavní bloky account a admin routes. Route-specific skeletony
  by omezily layout shift při pomalejším načtení.

#### P3-02: Footer odkazy mají slabší vizuální důraz než zbytek navigace

- Stav: **RESOLVED**
- Odkazy mají silnější kontrast a minimální hit area 44 px, přitom footer
  zůstává vizuálně klidný.

## 6. Souhrnná tabulka nálezů

| Finding | Stav               | Produkční vlastník                       |
| ------- | ------------------ | ---------------------------------------- |
| P0-01   | EXTERNALLY BLOCKED | Provozovatel a vlastníci integrací       |
| P0-02   | EXTERNALLY BLOCKED | Provozovatel nebo právník                |
| P1-01   | RESOLVED           | Kód ověřen                               |
| P1-02   | RESOLVED           | Kód a interakce ověřeny                  |
| P1-03   | RESOLVED           | Kód a automatizovaný stav ověřeny        |
| P1-04   | RESOLVED           | Copy ověřeno                             |
| P1-05   | EXTERNALLY BLOCKED | Provozovatel musí dodat kontakt          |
| P1-06   | RESOLVED           | Klient potvrdil časy 5:00–23:45          |
| P2-01   | RESOLVED           | Vizuálně ověřeno                         |
| P2-02   | RESOLVED           | Data a síťové chování ověřeny            |
| P2-03   | RESOLVED           | Klávesnicová interakce ověřena           |
| P2-04   | RESOLVED           | Hit areas a skip navigace ověřeny        |
| P2-05   | RESOLVED           | Vizuálně ověřeno                         |
| P2-06   | RESOLVED           | Copy ověřeno                             |
| P2-07   | RESOLVED           | DOM ověřen                               |
| P2-08   | RESOLVED           | Copy a limit 60 % ověřeny                |
| P3-01   | UNRESOLVED         | Nízká priorita, route-specific skeletony |
| P3-02   | RESOLVED           | Vizuálně a rozměrově ověřeno             |

## 7. Page-by-page audit po remediation

| Route                  | Finální stav                                                                 | Co zbývá                                             |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| `/`                    | Jasný hero, střídmé CTA, reálná fotka, cena, mapa a transparentní dostupnost | Ověřený e-mail, telefon a finální galerie od klienta |
| `/rezervace`           | Date-first kalendář, tři nejbližší dny v rychlém přehledu, keyboard a retry  | Ostrý backend a platba                               |
| `/login`               | Čistý formulář, lokální demo, provider gating, české chyby a 44px cíle       | Ostré identity po připojení backendu                 |
| `/account`             | Přehledná věrnost a termíny, čistý design systém                             | Reálná data po připojení backendu                    |
| `/admin`               | Přehledná desktop i mobilní navigace, česká lokální demo data                | Ostré zápisy a integrace po připojení Supabase       |
| `/faq`                 | Dvacet klientských odpovědí, odkazy a FAQPage strukturovaná data             | Aktualizovat při změně provozních pravidel           |
| `/vybaveni`            | Reálná fotografie a poctivé placeholdery, věcný nadpis                       | Finální seznam a fotografie od klienta               |
| Legal routes           | Správně `noindex`, transparentní blokace                                     | Schválené dokumenty před produkcí                    |
| `/admin/design-system` | Jediný H1 a živý vzor mobilní admin navigace                                 | Průběžně udržovat se změnami komponent               |
| Loading, empty, error  | Textové notices, `aria-live`, retry a stabilní skip cíl                      | Route-specific skeletony jako nízká priorita         |

## 8. Funnel audit

1. **Pochopení nabídky:** hero vysvětluje soukromí, cenu, místo a další krok.
2. **Rychlá kontrola dostupnosti:** tři nejbližší dny v hero nepřetěžují
   uživatele a rozlišují ukázkový stav.
3. **Volba data a času:** měsíční date-first kalendář, přesné rozsahy, délka a
   cena jsou na jednom místě.
4. **Přihlášení:** demo e-mailový tok je srozumitelný; neaktivní OAuth volby se
   nezobrazují.
5. **Platba:** FAQ uvádí kartu, Google Pay a Apple Pay přes Stripe Checkout;
   ostrá dostupnost všech metod ještě není end-to-end ověřená.
6. **Potvrzení a účet:** účet ukazuje čitelný termín bez duplicit a jasný stav.
7. **Vstup:** instrukce jsou srozumitelné, fyzický zámek a doručení zůstávají
   externě blokované.

## 9. Responsive a accessibility

### Potvrzeno

- 320 až 1728 px bez horizontálního overflow na veřejných routes i v mobilní
  administraci.
- Veřejné i admin menu podporuje Escape, návrat focusu a správné ARIA stavy.
- Skip link je první focusovatelný prvek a zůstává stabilní při streamingu.
- Kalendář podporuje šipky, Enter, roving tabindex a textové popisy stavů.
- Focus outline, reduced motion, `aria-live` notices a význam nezávislý na barvě
  prošly kontrolou.
- Footer, login mode switch a samostatný mobilní odkaz zpět splňují interní
  44px hit area.

### Mezery

- Doslovný 200% browser zoom a screen-reader poslech je potřeba provést při
  ručním finálním QA na cílových prohlížečích.

## 10. Design-system compliance

### Odpovídá

- Bitter s českou sadou, sémantické tokeny, tmavé plochy a tmavě zelená se
  zlatým akcentem.
- Dodané klientské logo ve veřejném headeru, administraci, loginu i patičce.
- Konzistentní radius karet, jeden hlavní CTA v rozhodovacím bloku a Lucide
  ikony.
- Přesné časové rozsahy, české labels a transparentní preview stavy.
- Žádné glassmorphism, glow, dekorativní gradienty ani nafouknuté marketingové
  sliby.
- Referenční stránka má jeden H1 a obsahuje aktuální mobilní admin vzor.

Při finálním průchodu nebyla zjištěna další interní odchylka. Doslovný 200%
browser zoom a screen-reader poslech zůstávají ručním předprodukčním QA, nikoli
potvrzenou design-system chybou.

## 11. Priority po auditu

1. Potvrdit správný Supabase projekt a dokončit ostrý end-to-end funnel.
2. Dodat a schválit právní dokumenty.
3. Dodat potvrzený e-mail a telefon bez použití Wix template kontaktů.
4. Provést ruční screen-reader a doslovný 200% browser zoom test.
5. Doplnit route-specific skeletony jako nízkou prioritu.
6. Nahradit galerijní placeholdery finálními fotografiemi od klienta.

## 12. Acceptance checklist

### Před klientskou prezentací

- [x] Hero vysvětluje nabídku, cenu, lokalitu a další krok.
- [x] Preview dostupnost je jasně označená jako ukázková.
- [x] Lokální admin a klientský demo login funguje bez Supabase.
- [x] Veřejný web a mobilní admin fungují bez horizontálního overflow.
- [x] Keyboard date selection, Escape, skip link a reduced motion E2E prošly.
- [x] Neaktivní OAuth poskytovatelé se nezobrazují.
- [x] Demo admin používá lokální česká data.
- [x] Account nezobrazuje duplicitní čas ani cizí vizuální dekorace.
- [x] Plán a inspirace zůstávají v administraci a připravenost nepřekračuje 60 %.

### Před produkčním spuštěním

- [ ] Je potvrzený správný Supabase projekt a aplikované migrace.
- [ ] Auth, RLS, rezervace a ochrana proti overlapu prošly ostrým testem.
- [ ] Stripe Checkout a webhooky prošly testem včetně retry a expiry.
- [ ] Nuki a doručovací kanály prošly fyzickým end-to-end testem.
- [ ] Obchodní podmínky a privacy jsou schválené.
- [ ] Kontaktní údaje jsou potvrzené.
- [x] Provozní časy 5:00–23:45 jsou potvrzené a sjednocené.
- [ ] Payment copy odpovídá skutečně aktivním metodám.
- [ ] Doslovný 200% browser zoom a screen-reader test prošly.
- [ ] Každý externě blokovaný P0 a P1 má vlastníka a termín.

## 13. Finální závěr

Remediation uzavřela všechny původní P1 kódové nálezy a všech osm P2 nálezů.
Jediným otevřeným lokálním nálezem je nízkoprioritní P3 route-specific skeleton;
ten neblokuje klientskou prezentaci. Produkci nadále blokují výhradně chybějící
vstupy a ověření mimo lokální demo: backendové integrace, právní dokumenty a
kontakty.
