# Registrace před nákupem a zvýraznění e-mailů

Rozsah: schválené body 1–4 ze zpráv NAVI GYM z 29. 10. 2026. Instagram ani
automatické zpětné přiřazování hostovských nákupů nejsou součástí změny.

## Prověření a jednorázová oprava

Potvrzená hostovská objednávka s pěti termíny obsahovala překlep v doméně
kontaktního e-mailu. Historie dokládá přijetí původního potvrzení poskytovatelem,
ne potvrzené doručení do schránky. Cílový účet měl ověřenou správnou adresu;
shodovalo se jméno i normalizovaný telefon. Osobní údaje a produkční ID nejsou
součástí repozitáře ani veřejných issues.

Schválená jednorázová oprava byla po místním nácviku dokončena. V jedné transakci
se změnily pouze vlastník a kontaktní adresa objednávky a jejích pěti rezervací
s časem aktualizace; vznikl jeden záznam v historii činností. Časy, ceny, stav,
platby, doklady, věrnostní příznaky, pipeline a zprávy byly porovnány před a po
operaci. Kódy zatím neexistovaly; jejich obvyklé budoucí doručování používá
opravenou adresu. Přiřazených pět potvrzených vstupů se nyní započítává do věrnosti,
bez zpětné změny ceny.

`scripts/operations/attach-verified-guest-order.sql` je ruční provozní postup,
nikoli migrace, endpoint nebo automatická funkce. Vyžaduje explicitní seznam
pěti ID, ověřenou identitu a původní adresu. Při změně stavu, existujícím kódu,
nedokončeném potvrzení, probíhající změně termínu či dokladu operaci odmítne.
Opakování stejné opravy rovněž odmítne. Produkční kontrola po provedení potvrdila
pět přiřazených rezervací, nezměněnou platbu a pouze dvě původní zprávy s původními
časy odeslání. Nic nebylo znovu odesláno.

## Web a administrace

- Host uvidí výhody účtu před kalendářem a znovu v rekapitulaci. Text vysvětluje
  přehled rezervací, nastavený každý N. vstup zdarma i to, že starší hostovské
  rezervace se automaticky nepřiřadí. Nákup bez registrace zůstává možný.
- Přihlášeným zákazníkům se výzva nezobrazuje. Odkaz uchovává aktuální výběr
  termínů i při přepínání dnů v kalendáři a návratu z přihlašovacího formuláře.
- Obě registrační výzvy lze samostatně upravit v **Obsah webu → Výzvy
  k registraci**. Používají stávající tužky, dialogy a skutečné rozložení;
  samostatně se ukládá nadpis, hlavní text, popisek odkazu a poznámka pro hosty.
  Značka `{freeEntryEvery}` zůstává v původním textu a náhled ji doplní aktuálním
  intervalem. Cíl přihlášení a návrat k vybraným termínům řídí systém.
- V E-mailech je skutečný editor Tiptap 3.32.1: běžný text, H1–H3, tučné písmo,
  kurzíva, podtržení, odrážky, číslované seznamy a zpět/znovu. Je načítaný až
  v administraci; veřejný kalendář editor nestahuje.
- Dokument má výslovně povolené uzly a značky, omezení velikosti a hloubky a
  validaci na klientu i serveru. HTML se sestavuje z pevných značek a escapovaného
  textu. Proměnné nemohou vkládat HTML ani formátování a doplní se i při rozdělení
  mezi různě formátované části textu. Vedle dokumentu se uchovává čitelný prostý
  text. Starší textové šablony dál fungují bez převodu v databázi.
- Uložené žádosti o odeslání nejsou přerenderované a změna šablony nic nerozesílá.
  Nezvýrazněné starší šablony zachovávají dosavadní HTML. Migrace není potřeba;
  ruční provozní SQL se při nasazení nespouští.

## Ověření

Samostatné lokální databáze `navi_registration_integration_test` a
`navi_registration_browser_test`, Node.js 22.23.4 a síťově omezené náhrady Auth,
Resend, Comgate a dalších poskytovatelů. Žádná produkční testovací data.

- 355 základních a 302 integračních testů prošlo. Zahrnuté jsou zpětná
  kompatibilita textových šablon, odmítnutí nebezpečného/rozsáhlého dokumentu,
  dosazení proměnných přes hranice formátování, autentizační odkazy, povinné
  finanční údaje a přesná obnova rozpracovaného outboxu po změně šablony.
- SQL omezení, formát, lint a typy prošly. Audit závislostí má nula nálezů.
- Prohlížečová sada navíc ověřuje osm samostatných textových polí obou výzev,
  jejich promítnutí na veřejné stránky, zobrazení jen hostům, bezpečné zobrazení
  doslovného HTML, bohaté formátování, uložení/načtení a mobilní šířku.
- Testy porovnávají rezervace, objednávky, platby, kódy i zprávy před a po
  ukládání. Používají jen oddělené lokální databáze a náhrady poskytovatelů.
- Aktuální výsledek kompletního nezávislého ověření je dohledatelný v PR #290.

Nový kód zůstává v samostatném PR. Automatický Vercel deployment této větve je
vypnutý. Sloučení a nasazení těchto webových úprav nejsou součástí tohoto kroku.
