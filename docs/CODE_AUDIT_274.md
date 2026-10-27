# Audit aplikace a PR #274 — 27. října 2026

Audit pokrývá změny kreditů i jejich návaznosti v aplikaci. Výsledkem jsou opravy
reprodukovaných chyb, měření a regresní testy; nejde o záruku absence všech chyb
ani o externí penetrační test. Produkční kontrola před nasazením byla pouze čtením.

## Pokrytí

Inventář obsahuje 443 TS/TSX modulů, 48 stránek, 22 HTTP routes, 24 souborů server
actions a 69 služeb. Kontrola hranic importů prochází celý graf 81 klientských
vstupů, vynechává typové importy a respektuje hranici `use server`: nenalezla
přenos databáze, serverového prostředí ani `server-only` modulů do klienta.

| Oblast                      | Kontrola a důkaz                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identita a oprávnění        | Guards, Supabase session/middleware, role z databáze, demo/produkční oddělení, callbacky, bezpečné návratové URL, samostatná autorizace admin actions. Route/security/E2E testy zahrnují anonymní i cizí přístup. Produkční metadata potvrzují RLS na všech 34 veřejných tabulkách a nulové přímé oprávnění běžného uživatele k profilovým sloupcům včetně role. |
| Rezervace, rozvrh a blokace | Serverová kontrola dostupnosti, zamykání rozvrhu, exclusion constraints, zachování starších rezervací/kódů, DST a blokace/dávky. Ověřují integrační a browser scénáře rozvrhu, blokací, rescheduling a dostupnosti.                                                                                                                                              |
| Peníze a kredity            | Neměnná historie, disponibilní/rezervovaný zůstatek, vlastnictví, souběh, idempotence, poměrná alokace, voucher/bonus, legacy verze, jednotlivé položky objednávky, pozdě přijaté a vrácené doplatky. Zjištění níže mají regresní testy.                                                                                                                         |
| Externí efekty a cron       | Intent před providerem, timeouty, ověření částky/měny/prostředí/reference, ztracené odpovědi, nevratné stavy, prioritní příprava PINů a férovost omezených dávek. Nikdy se k ověření nevolá ostrý watchdog ani zákaznická platba.                                                                                                                                |
| Komunikace a dokumenty      | Idempotentní e-mailové doručení a jeho bezpečné časové okno; oddělené připomínky a výchozí večerní varianta, escape textů, povinná finanční fakta, archiv, původní faktury a soukromé PDF. Odstraněné slepé POST retry ve starších SMS/WhatsApp adaptérech.                                                                                                      |
| Veřejné API, obsah a média  | Dostupnost vrací jen veřejná data, chyby neukazují domnělé volné sloty, realtime používá signál bez PII. Kontrolovány JSON-LD escape, náhledy e-mailů, upload limity/magic bytes, podpisy OAuth/webhooků, proxy obrázků a oddělení simulace zákazníka od skutečných efektů.                                                                                      |
| Výkon                       | Dávkové ceny a rozvrh, přebytečné čtení historie, práce při rozpracovaném doplatku, omezení seznamů, časové/intervalové indexy, query/lock/provider timeouty, 15s klientská cache, rušení a pořadí odpovědí. Výsledky měření níže.                                                                                                                               |
| Frontend                    | Stávající veřejný design zachován. Ověřeny mobil, klávesnice, dialogy, stav při odesílání, návrat z brány, jednotlivé rezervace a skutečné částky kredit/doplatek. Historie kreditů je pojmenovaná klávesnicí ovladatelná scrollovací oblast.                                                                                                                    |
| Databáze a release          | Dvě aditivní migrace bez obchodních seedů/backfillů. Rozšířená zkouška přechodu z předchozího schématu uchovává původní pole osmi tabulek a ověřuje prázdné soukromé kreditní tabulky i nové indexy.                                                                                                                                                             |
| Kvalita a konfigurace       | Typy, lint, formátování, produkční build, lockfile a audit závislostí. Stávající finanční pohled nad cash platbami nepřičítá kredit jako nový peněžní příjem. Zdokumentované provozní limity a obnova nenahrazují stav providera domněnkou.                                                                                                                      |

## Opravené nálezy

| ID  | Závažnost | Trigger a dopad                                                                                                         | Oprava a ověření                                                                                                                                                                        |
| --- | --------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A01 | P1        | Dispatcher načte doplatek před potvrzením refundace; pozdější PAID callback mohl změnit `refunded` zpět na `succeeded`. | Terminální stav se znovu kontroluje pod zámkem. Test předává skutečně zastaralý načtený řádek po dokončené refundaci.                                                                   |
| A02 | P1        | Ověřená platba dorazí po zrušení nabídky. Původní rezervace se nepřesunula, ale chyběla evidence vrácení doplatku.      | Přechod do kontrolované obnovy/refundace; žádné obnovení zrušeného cílového slotu. Test ověřuje původní čas, jedinou refundaci a nulovou komunikaci o změně.                            |
| A03 | P2        | Deset starých refundací čekajících na obsluhu zaplní omezenou retry dávku a novější náprava se nikdy nedostane na řadu. | Automatická fronta vybírá pouze práci, kterou může provést. Test s limitem 1 prokazuje postup další refundace.                                                                          |
| A04 | P2        | Nezkontrolovaný platební intent s NULL časem kontroly se řadil až za staré opakované kontroly.                          | NULLS FIRST a stabilní pořadí; test ověřuje první kontrolu nového intentu.                                                                                                              |
| A05 | P2        | Návrat k rozpracovanému doprovodu ukazoval celou cenu místo uloženého poměru kredit/cash.                               | Zobrazení a serverový retry zachovají původní tender a odmítnou změněný quote. Integrační i browser scénář opakuje návrat do stejné platby.                                             |
| A06 | P2        | Kredit hosta zmizel z přehledu při vzniku profilu se stejným e-mailem, přestože ještě neproběhlo ověřené převzetí.      | Nevyzvednutý zůstatek zůstává viditelný jako čekající na ověření. Převod nadále vyžaduje ověřený Auth e-mail.                                                                           |
| A07 | P2        | Webhook bez Content-Length mohl načíst příliš velké nebo nedokončené tělo před kontrolou limitu.                        | Sdílené streamové limity i timeout, ukončení čtení a kontrolované HTTP odpovědi. Testy simulují přetečení, nepravdivou délku a zablokované čtení.                                       |
| A08 | P2        | Volný text chyby mohl obsahovat Bearer/Basic token, parametr secret nebo heslo v databázové URL.                        | Sdílená redakce platí i pro tyto řetězce; testy ověřují odstranění hodnot při zachování diagnostiky.                                                                                    |
| A09 | P2        | Starší SMS/WhatsApp adaptéry opakovaly ne-idempotentní POST po ztrátě odpovědi.                                         | Odeslání se slepě neopakuje a WhatsApp bez potvrzovacího ID není označen jako přijatý. Testy nahrazují fetch a počítají skutečné pokusy. Aktivní doručování PINů přes Zernio se nemění. |
| A10 | P2        | Rekapitulace a checkout znovu načítaly stejný ceník/rozvrh pro každou položku.                                          | Dávkové funkce a test rovnosti cen včetně DST; počet cenových dotazů je konstantní. Dostupnost se při potvrzení stále kontroluje na serveru.                                            |
| A11 | P3        | Formuláře načítaly historii 50 pohybů, ač potřebují jen zůstatek; čekající změna navíc zbytečně stavěla celý kalendář.  | Samostatné čtení zůstatku, přesunutí zbytečných čtení mimo pending větev.                                                                                                               |
| A12 | P2        | Historie změn podle zákazníka a výběr skutečně proveditelné obnovy neměly odpovídající indexy.                          | Dva úzké částečné indexy, měření na oddělených syntetických datech a migrační test.                                                                                                     |

A01–A03 byly nejprve reprodukovány třemi selháními regresních testů; po opravě
prošly. Změny jsou v samostatných věcných commitech a issue #275.

## Měření

- Veřejná produkční dostupnost před nasazením: pět GET čtení, vše HTTP 200;
  celkové časy 215, 192, 292, 709 a 249 ms, medián 249 ms. Bez přihlášení,
  rezervace, platby nebo volání zámku. Tato hodnota není tvrzením o zrychlení
  způsobeném kredity; jde o výchozí ověření stávající veřejné cesty.
- Izolovaná cenová sada: 20 samostatných volání provede 60 dotazů, dávka stejné
  ceny získá třemi dotazy. Na místním PostgreSQL diagnosticky 9 → 1 ms; test
  vynucuje rovnost výsledků a konstantní rozpočet dotazů, nikoli čas závislý na HW.
- Historie 100 000 fiktivních dokončených změn: 6,485 → 0,029 ms, index scan
  `reservation_change_user_completed_idx` místo filtrování a řazení historie.
- Fronta s dalšími 10 000 fiktivními refundacemi čekajícími na obsluhu:
  1,546 → 0,008 ms pro výběr proveditelné práce, použitý částečný recovery index.
  To jsou lokální zátěžové scénáře, nikoli produkční zákaznická data.

## Závěrečné ověření a release

Kompletní jednotkové, integrační, SQL a browser sady, build, audit závislostí a
GitHub Actions se spouštějí na finálním kódu po opravách. Výsledný commit a výsledek
release se doplní do PR. Připravené migrace nic neposílají, neaktivují testovací
nastavení ani neupravují časy/ceny/PINy existujících rezervací.

Před produkční migrací se porovnají původní pole v rámci stejné transakce; po
nasazení se kontroluje správný commit, stav služby, soukromí tabulek a veřejná
odezva pouze čtením. Souhlas uživatele v tomto zadání pokrývá merge i nasazení.
