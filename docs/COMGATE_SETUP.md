# Comgate: příprava a aktivace plateb

Ověřeno 10. 9. 2026. Integrace používá Comgate REST API 2.0 a přesměrování na hostovanou bránu. Bez přístupových údajů web funguje pro prezentaci a registrace; placené rezervace nejsou dostupné. Rezervace se potvrdí teprve po serverovém ověření zaplacení. Na produkčním Vercelu (`VERCEL_ENV=production`) aplikace testovací režim odmítá. Testovací prostředí musí mít samostatnou databázi.

## Údaje provozovatele

V [Klientském portálu Comgate](https://portal.comgate.cz/) otevřete **Integrace → Nastavení obchodů → příslušný obchod → Propojení obchodu**. Zde je identifikátor propojení a jeho komunikační heslo. Nejde o přihlašovací heslo uživatele portálu. Pro testy použijte samostatné propojení a testovací nasazení. [Oficiální postup](https://apidoc.comgate.cz/faq/)

| Proměnná ve Vercelu   | Význam                                                               |
| --------------------- | -------------------------------------------------------------------- |
| `COMGATE_MERCHANT_ID` | Identifikátor propojení obchodu                                      |
| `COMGATE_SECRET`      | Komunikační heslo propojení; pouze server                            |
| `COMGATE_TEST_MODE`   | `true` pro simulaci, `false` pro skutečnou platbu; výchozí je `true` |
| `NEXT_PUBLIC_APP_URL` | Kanonická HTTPS adresa webu, pro produkci `https://www.navigym.cz`   |

API klíče zatím nejsou vyplněné. Do GitHubu ani do `NEXT_PUBLIC_*` proměnných heslo nepatří.

## URL a ochrana přístupu

V propojení obchodu nastavte URL pro předání výsledku na pozadí na **`https://www.navigym.cz/api/webhooks/comgate`**. Tuto adresu nelze nastavit parametrem vytvoření platby. Výsledek REST platby přijde jako JSON POST. Server ověří `merchant`, `secret`, testovací režim a následně načte stav přímo z API. Teprve po úspěšném zpracování vrátí HTTP 200. Neúspěšná oznámení Comgate opakuje až do 1000 pokusů. [Push notifikace](https://apidoc.comgate.cz/push-notifikace/)

PAID, CANCELLED a PENDING návratové URL nastavte v portálu pro příslušný web. Aplikace je u každé platby přepisuje parametry `url_paid`, `url_cancelled`, `url_pending` na privátní návratový odkaz. Návrat prohlížeče sám nepotvrzuje úhradu. [REST API](https://apidoc.comgate.cz/api/rest/)

Před aktivací ověřte odchozí IPv4 adresy hostingu a nastavte API whitelist. Pro příchozí webhook povolte na hostingu aktuální [rozsahy Comgate](https://payments.comgate.cz/ips-v4). Rozsahy je třeba průběžně aktualizovat. Při dynamickém odchozím IP řešte konfiguraci s Comgate a hostingem; nespoléhejte na neověřený rozsah nebo na libovolnou klientskou hlavičku IP. Veškerá komunikace je přes HTTPS. [Zabezpečení](https://apidoc.comgate.cz/zabezpeceni/)

## Chování implementace

- Vytvoření: `POST https://payments.comgate.cz/v2.0/payment.json`, HTTP Basic `merchant:secret`, JSON, částka v haléřích, CZK, české prostředí. Brána nabídne platební metody povolené v propojení obchodu.
- Stav: `GET /v2.0/payment/transId/{transId}.json`. Kontrolují se ID transakce, testovací režim a případný vrácený merchant; služba páruje částku, měnu a `refId` s uloženou objednávkou. Pouze `PAID` znamená zaplacení. `AUTHORIZED` je předautorizace, nikoliv úhrada.
- Expirace je `30m`, dynamické prodlužování vypnuté. Slot nelze uvolnit jen podle místního času, dokud brána transakci stále vede jako čekající.
- `refId` není v Comgate unikátní. Vytvoření se automaticky neopakuje. Timeout, serverová chyba nebo nečitelná úspěšná odpověď zůstává neurčitým pokusem k dohledání a smíření, aby nevznikla druhá platba.

Kontrakt, limity, stavy a návratové hodnoty: [oficiální API 2.0](https://apidoc.comgate.cz/api/rest/).

## Ověření před zapnutím

1. Dokončit aktivaci obchodníka a propojení u Comgate, vyplnit testovací údaje pouze v testovacím nasazení.
2. Nastavit všechny čtyři URL, whitelisty a kontaktní e-mail pro chyby v portálu.
3. Otestovat úhradu, zamítnutí, zrušení, expiraci, pozdní návrat, opakovaný webhook a dočasný výpadek jeho příjemce. Ověřit, že vznikne jediná platba a potvrzení rezervace.
4. Ověřit, že jiný merchant, režim, částka, měna nebo reference nemohou potvrdit rezervaci, a že host neuvidí cizí objednávku změnou ID.
5. Po úspěšném testování nasadit produkční údaje, nastavit `COMGATE_TEST_MODE=false`, ověřit povolené metody a provést kontrolní skutečnou platbu s provozovatelem. Prodej nezávisí na připojení fyzického zámku; samotné vstupní kódy se aktivují až po jeho otestování.

Refundace a automatické opakované platby nejsou tímto adaptérem zavedeny. Případnou refundaci řeší správce v Comgate portálu a navazujícím administrativním procesu.

## Provoz a obnova po výpadku

V administraci → Nastavení → Provoz rezervací zapněte platby až po ověření. Výchozí `paymentsEnabled=false`, `accessCodesEnabled=false`; počáteční datum je volitelné, horizont kalendáře se nastavuje zvlášť. Věrnostní vstupy zůstávají odměnou; prodej s voucherem se aktivuje společně s placeným prodejem.

Watchdog každých 5 minut ověřuje neukončené transakce a dokončuje uloženou pipeline. Neznámé založení bez `transId` vyvolá kritické upozornění s interní referencí. V portálu dohledat referenci a stav; správce nesmí pokus slepě opakovat. Po ověření existující transakce bezpečně doplnit její `transId` ke správnému lokálnímu payment ID (merchant, režim, částka a měna musí souhlasit), aby další watchdog stav ověřil API. Pokud Comgate prokazatelně nic nezaložil, správce může ukončit pokus jako failed a zrušit čekající rezervaci. Automatické dohledání podle neunikátní reference není implementováno.

Stejně se při neurčitém výsledku vytvoření kódu v Nuki nevytvoří další kód. Nejprve ověřit/odebrat původní autorizaci a srovnat její DB záznam. Skutečné odemčení a asynchronní instalace na fyzický zámek čekají na připojení zařízení.
