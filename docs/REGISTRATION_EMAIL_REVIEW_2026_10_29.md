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
- V E-mailech lze označený text zvýraznit tlačítkem Tučně a opětovným použitím
  zvýraznění odstranit. Podporovaný zápis je `**text**`, včetně více řádků.
- Náhled pracuje výhradně s ukázkovými proměnnými. HTML je vždy escapované;
  proměnné od zákazníka nezakládají formátování. Prostý text neobsahuje značky
  zvýraznění. Předměty a autentizační odkazy si zachovávají původní chování.
- Uložené žádosti o odeslání nejsou přerenderované a změna šablony nic nerozesílá.
  Nezvýrazněné šablony zachovávají dosavadní HTML. Nová závislost ani migrace
  nejsou potřeba. Provozní SQL se při nasazení nespouští.

## Ověření

Samostatné lokální databáze `navi_registration_integration_test` a
`navi_registration_browser_test`, Node.js 22.23.4 a síťově omezené náhrady Auth,
Resend, Comgate a dalších poskytovatelů. Žádná produkční testovací data.

- 349 základních a 300 integračních testů prošlo; integrační sada obsahuje
  nácvik úspěšné opravy, odmítnutí změněné identity/seznamu/kódu, opakovaného
  běhu a kontrolu nulového opakovaného odesílání při následném fulfillmentu.
- SQL omezení, formát, lint a typy prošly.
- Kompletní prohlížečová sada se ověřuje před předáním PR.

Nový kód zůstává v samostatném PR. Automatický Vercel deployment této větve je
vypnutý. Sloučení a nasazení těchto webových úprav nejsou součástí tohoto kroku.
