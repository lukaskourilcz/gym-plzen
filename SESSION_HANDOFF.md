# Předání session

Aktualizováno: 5. 9. 2026

## Stav

**Produkční audit administrace (5. 9. 2026).** Prošlo se všech 17
administrátorských obrazovek bez chyb v konzoli. Produkční CMS je doplněný na
122 českých hodnot včetně kontaktu, provozního řádu a všech 12 ilustračních
fotografií. Cena je sjednocená na 289 Kč. Dvanáct plateb visících po
expirovaném checkoutu bylo označeno jako neúspěšné a dvě prošlé slevy byly
deaktivované. Uvolňování expirovaných rezervací nyní aktualizuje i související
platbu. Prázdný ostrý provoz už nikdy nedoplňuje fiktivní členy, rezervace ani
zprávy; výpadek databáze se zobrazí jako chyba s možností opakovat načtení.
Migrace 0011 doplnila všech 15 chybějících indexů cizích klíčů a databázový
Performance Advisor už tento nález nehlásí.

**Bezpečnost demo režimu.** Rezervované demo identity jsou v produkci
odmítnuté při přihlášení i při serverové kontrole oprávnění. Lokální demo
zůstává pro vývoj, je jasně označené a jeho serverové akce nemohou zapisovat.
Před předáním musí provozovatel založit a ověřit skutečný správcovský účet;
po handoffu je třeba demo identity odstranit ze Supabase Auth. Další externí
blokátory a doporučení jsou průběžně vedené v `NEEDED.md`.

**Dokumenty a sestavení.** `iconv-lite` je explicitní produkční závislost,
aby generování faktur/PDF nebylo závislé na náhodném zanoření balíčků. Build,
typová kontrola, lint a unit testy jsou součástí finálního ověření tohoto
release.

**Rebrand na NAVI (4. 9. 2026).** Značka je přejmenovaná všude, kde ji vidí
zákazník: web, metadata, JSON-LD, pět e-mailových šablon, příloha kalendáře,
popis platby ve Stripe, administrace, testy i dokumentace. Uložené texty v
databázi přepíše `npm run rebrand:navi` (nejdřív vypíše, co změní, pak s
`--write`); je idempotentní a nesahá na doménu `namastegym.cz` ani na právní
znění. Starý Instagram přepisuje na `@navi_plzen`. Kontaktní e-mail je nově
`info@navigym.cz`.

**Logo.** `BrandMark`, `BrandLogo` a `BrandLockup` kreslí dodaný znak
(kettlebell s N) jako CSS masku obarvenou `currentColor`: na světlém podkladu
zeleně, na ink zlatě. Dodané logo je zlaté a zlatá na krémovém pozadí má
kontrast ~1,9:1, proto se tam nikdy nepoužívá. **PNG jsou siluety vytažené z
3D vizualizace klienta** (`public/images/navi-logo-source.png`) — tvarem věrné,
ale s měkkými hranami renderu. Až dodá vektory, stačí vyměnit `navi-mark.png`,
`navi-wordmark.png`, `navi-logo.png` a `navi-logo-email.png` a přegenerovat
`src/app/icon.png`; v kódu se nemění nic.

**Ceny.** Standardní cena je 289 Kč. Akční okno se nastavuje v administraci →
Vstupné a věrnost a řídí se **okamžikem vytvoření rezervace**, ne termínem: kdo
rezervuje během akce, platí akční cenu i za termín o měsíce později.
Věrnostní 10. vstup zdarma platí i uvnitř akce. Změna termínu cenu
nepřepočítává. Texty s cenou používají zástupné `{price}`
a `{pricePerPerson}`, takže nemohou zastarat.

**Rozsah rezervací** už není napevno 60 dní: nastavuje se v administraci →
Nastavení (7–365). Pro říjnovou akci doporučeno 130 dní.

**Administrace.** V Členech lze udělit i odebrat roli správce (posledního
správce systém odebrat nedovolí), v Nastavení přibyly fotografie galerie a zón
se štítkem „Ilustrační foto“ a rozsah rezervací. Měřicí ID GA4 a Meta Pixelu se
berou z env; bez nich se neuloží žádný skript a lišta souhlasu se nezobrazí.

**Drobnosti z klientského e-mailu:** větší text v kalendáři, menší mezera mezi
„Jak to funguje“ a „Ceníkem“, tlačítko v závěrečném pásu na mobilu na střed.

**Přepínač vzhledu** je nově **jen na stránce `/dev`** a nikde jinde se
nevykresluje : v hlavičce ani v mobilním menu, v žádné šířce. Volba zapíše
cookie `ns_design` a vzhled se propíše na celý web; samotné ovládání ale
zůstane na `/dev`. Je to strukturální záruka (hlavička komponentu vůbec
neimportuje, hlídá to unit test), ne CSS pravidlo, které by šlo přebít.

**Doklady o zaplacení.** Po potvrzené platbě se vystaví číslovaný doklad
a odejde e-mailem v PDF. Vystavovatel je předvyplněný podle čl. 1.2 VOP
(Renáta Janoušková, IČO 29619998) : zkontrolovat v administraci → Nastavení
a branding → Fakturační údaje, doplnit DIČ a sazbu, pokud je studio plátcem
DPH, a **zaškrtnout automatické odesílání** (výchozí je vypnuto). Čísla jdou
po sobě v rámci roku (`2026-0001`), na jednu rezervaci nejvýš jeden doklad,
věrnostní vstup zdarma doklad nedostane. Přehled, stažení PDF a „Poslat
znovu“ jsou v administraci → Doklady. Migrace
`drizzle/0010_billing_documents.sql` je v produkčním schématu ověřená.

**Doména.** Web běží na **`https://www.navigym.cz`** (Vercel; `navigym.cz`
přesměrovává 308 na `www`). Přepnuté je DNS, `NEXT_PUBLIC_APP_URL` i Supabase
Auth, takže sitemap, robots i `canonical` uvádějí novou doménu. `namastegym.cz`
zatím servíruje stejný web souběžně, ale posílá `canonical` na novou doménu, což
SEO drží pohromadě, než se z něj udělá 301. Zbývá přepsat **Stripe a Nuki
webhooky** a **referrery klíče Google mapy**; e-maily zatím odcházejí
z `noreply@namastegym.cz`, protože v Resendu je ověřená stará doména.

**Ilustrační fotky** jsou hotové pro všech dvanáct míst a uložené v
`public/images/photos`. Produkční CMS používá stejné cesty a web je značí
malou informační ikonou s vlastním tooltipem.

**Nové v této session (větev `claude/mobbing-feature-ideas-kens00`).** Veřejný
web umí dvě varianty vzhledu: schválenou **Klasickou** a novou **Moderní**.
Přepínač je **skrytý před návštěvníky**: odemkne se až otevřením
`www.navigym.cz/dev`, což nastaví cookie `ns_preview` jen v daném prohlížeči.
Stránka `/dev` je `noindex`, mimo sitemapu i robots. Po odemčení je přepínač
vpravo nahoře v hlavičce (od `xl` výš), na užších displejích v mobilním menu;
na `/dev` jde náhled zase vypnout. Volba se ukládá do cookie `ns_design` a inline skript ji ještě
před vykreslením propíše jako `data-design` na `<html>`, takže se nikdy
neprobliskne druhý vzhled a úvodní stránka si drží ISR. Rozdíly jsou výhradně v
CSS pod `[data-design="modern"]`; klasický vzhled se nezměnil (e2e to ověřuje
přesnými velikostmi 36/48/60 px). Varianta je dočasná pomůcka: po schválení se
Moderní stane výchozí a přepínač se odstraní.

Věrnostní program je vidět všude, kde dává smysl: v potvrzovacím e-mailu přes
novou proměnnou `{loyalty}` (u hostů se prázdný odstavec zkolabuje), na stránce
po rezervaci, ve sloupcích „Návštěvy“ a „Do zdarma“ v administraci → Členové a
v účtu jako segmentový pás (Klasický) nebo zlatý prstenec (Moderní).

Rezervaci lze přidat do kalendáře: `.ics` z autorizované route
`/api/reservations/[id]/calendar.ics`, odkaz na Google Kalendář a stejná příloha
v potvrzovacím e-mailu. Do kalendáře se nikdy nedostane vstupní kód.

Administrace má místo obecného „Přehledu“ provozní stránku **Dnes**: dnešní
program se stavy, dnešní tržba (počítá jen skutečně zaplacené vstupy), dnešní
odemčení ze zámku, sedmidenní trend a feed toho, co vyžaduje pozornost.

Klientská revize veřejného webu je implementovaná a připravená k prezentaci.
Veřejný header používá přesné dodané logo v horizontálním uspořádání: lotus
vlevo a wordmark `NAVI Private Gym` vpravo. Vertikální varianta zůstává na
přihlášení a v patičce.

Úvodní stránka odpovídá klientským poznámkám: širší navigace ve verzálkách,
zlaté „NAVI.“ v hero, Plzeň - Roudná, otevírací doba 5:00–23:45,
informační pás v prvním viewportu, vycentrované časy, každý 10. vstup zdarma,
stejně velké kroky 01–06 a bílá cenová karta. Hero adresa a otevírací doba jsou
vedle sebe se zarovnanými CTA pod nimi. Informační pás začíná
„Samoobslužné fitness“ a karta dostupnosti výslovně uvádí cenu za 75 minut.
Kontaktní údaje se neopakují před mapou: adresa a otevírací doba zůstávají jen
v mapové kartě, telefon a e-mail v patičce.
Šest provozních kroků používá zlaté štítky 01–06 přímo před nadpisy. Nadpisy
mají v každém řádku společnou výšku a navazující text začíná pod nimi ve stejné
úrovni. Všechny podpůrné lotusové motivy používají oficiální klientskou
pětilistou značku; ve FAQ se lotos při otevření plynule změní na otazník.
Favicon v `src/app/icon.png` používá stejný přesný klientský lotus ve zlaté
barvě na tmavě zeleném podkladu. Starý ručně kreslený SVG favicon byl odstraněn.
Mapa se načítá vycentrovaná pomocí souřadnic a vlastní přední karta NAVI zůstává
nad ní. Dokud není ve Vercelu platný Google API klíč i Map ID, používá se bez
chyb standardní embed; vlastní lotusový marker se zapne až s oběma hodnotami.
Závěrečný zelený CTA pás je vlevo zarovnaný s okolním obsahem; na desktopu
navazuje větší tlačítko Rezervovat, na mobilu se prvky řadí pod sebe vlevo.
Pod nadpisem je zlatou linkou oddělený editovatelný citát.
Cenová karta má label „Jednorázový vstup“, cenu ve zlaté brandové barvě, délku
vstupu a rezervační tlačítko. Nemá text „Celý gym jen pro vás“, opakovaný
věrnostní text ani poznámku o registračních poplatcích.
V desktopovém hero je rezervační kalendář svisle vycentrovaný vůči celému
hero layoutu.
Resend doména `namastegym.cz` je ověřená a Vercel má nastavený serverový
sender `NAVI Private Gym <noreply@namastegym.cz>`. Administrace →
**E-maily** obsahuje pět editovatelných českých šablon: potvrzení registrace,
obnovu hesla, potvrzení rezervace, vstupní kód a storno. Všechny mají stejné
logo, náhled, proměnné a testovací odeslání na zadanou adresu. Potvrzení
rezervace se odesílá po potvrzené platbě, vstupní kód a storno používají stejný
systém šablon.

Přibyly `/forgot-password` a `/reset-password`. Obnova hesla už volá Supabase
Auth s rate-limitem a odpovědí, která neprozradí existenci účtu. Custom SMTP
přes Resend je nastavený a resetovací tok na vlastní doméně byl ověřený. Aby
administrace mohla propsat šablony registrace a resetu přímo do Supabase Auth,
ještě doplnit ve Vercelu serverový `SUPABASE_MANAGEMENT_API_TOKEN`. Přesný
postup je v §7
[MANUAL_STEPS.md](./MANUAL_STEPS.md#7-supabase-auth-smtp-a-šablony-z-administrace).

Administrace už neobsahuje položku ani route „Plán spuštění“. `/admin/content`
je přepsaný na klientsky bezpečný editor: aktuální texty jsou rozdělené na
Hero, informační lištu, průběh rezervace, ceník, galerii, Vybavení, FAQ, mapu a
kontakt a provozní řád. Jedinou editovatelnou hodnotou je text po kliknutí na
ikonu tužky; klíč, typ a interní skupina se nikde nezobrazují. Texty z FAQ a
Vybavení jsou nyní také čtené z CMS, nikoli z lokálních konstant.
Kořenový layout je výškový flex sloupec a přímý `main` vyplňuje volné místo.
Footer proto končí u spodního okraje viewportu na krátkých veřejných stránkách
a za obsahem na stránkách delších.

`/faq` obsahuje všech dvacet klientem dodaných otázek a odpovědí a stránka
generuje `FAQPage` strukturovaná data. FAQ i Vybavení jsou editovatelné přes
zjednodušený editor obsahu.

## Potvrzené podklady

- adresa: `Křížkova 424/23, Plzeň - Roudná`;
- otevírací doba: každý den 5:00–23:45;
- slot: 75 minut;
- kapacita: až 5 osob včetně dětí;
- cena: 289 Kč za rezervaci, každý 10. vstup zdarma;
- Instagram: `@navi_plzen`;
- logo: zdroj od klienta, odvozené transparentní soubory jsou v
  `public/images/navi-logo.png`, `navi-mark.png` a `navi-wordmark.png`.

Nepoužívat telefon, e-mail ani další kontakty z Wix šablony. Produkční CMS
obsahuje potvrzený e-mail `info@navigym.cz`, telefon, adresu a aktuální odkazy
na Instagram a Facebook.

## Demo

Lokální demo vyžaduje `DEMO_AUTH_ENABLED=true`,
`DEMO_AUTH_SECRET` dlouhý alespoň 32 znaků a volitelně
`BOOKING_PREVIEW_FIXTURE=true`.

Přihlašovací stránka demo údaje nezobrazuje. Demo režim se v produkci
automaticky vypne a rezervované demo identity jsou odmítnuté i na serveru.

## Poslední ověření

Vše běželo na Node 22:

- `npm run format:check`: prošlo;
- `npm run lint`: prošlo;
- `npm run typecheck`: prošlo;
- `npm test`: 95 passed;
- lokální admin Playwright: přihlášení, mobilní menu a všech 17
  administrátorských rout prošlo bez browser exception nebo error boundary;
- produkční veřejný smoke test bez databáze: 8 passed, 1 očekávaně skipped;
- produkční skip-link stress test: 5/5 passed;
- `npm run build`: prošlo bez `DATABASE_URL`, nedostupná DB správně přepne web
  na bezpečný fallback;
- `npm audit --omit=dev`: 2 moderate nálezy v PostCSS přes Next.js;
- plný `npm audit`: 6 moderate, 0 high a 0 critical. Dostupná automatická
  oprava přechází na Next.js 16.3.4, proto nebyl bez samostatného regresního
  auditu použit `npm audit fix --force`.

Vizuálně byly ověřeny desktop 1440 × 900 a mobil 390 × 844. Responzivní měření
proběhlo od 320 do 1728 px bez horizontálního overflow. Mobilní menu, login,
FAQ accordion, focus, Escape a reduced motion mají regresní pokrytí.

## Co zbývá

Úkoly vyžadující klienta nebo externí služby jsou v
[NEEDED.md](./NEEDED.md). Nejdůležitější jsou:

1. skutečný správcovský účet a odstranění produkčních demo identit;
2. právní potvrzení VOP a provozního řádu;
3. ověření schránky `info@navigym.cz`, domény v Resendu a ostrého e-mailového
   workflow;
4. oprava Google Maps klíče, zapnutí GA4/Meta a přepnutí webhooků Stripe/Nuki;
5. kontrola fakturačních údajů a ostrý test platby, dokladu i kalendářové
   přílohy;
6. potvrzení zbývajícího aktivního voucheru, ochrana proti uniklým heslům a
   srovnání historie migrací 0006–0010.

Desktopové i mobilní veřejné menu je ve verzálkách; desktopové položky jsou
roztažené přes samostatný široký středový prostor headeru.

## Orientace v repozitáři

- aktuální stav produktu: [README.md](./README.md);
- externí kroky: [NEEDED.md](./NEEDED.md) a
  [MANUAL_STEPS.md](./MANUAL_STEPS.md);
- vizuální pravidla: [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md);
- poslední audit: [docs/UX_AUDIT.md](./docs/UX_AUDIT.md);
- E2E režimy: [tests/e2e/README.md](./tests/e2e/README.md).
