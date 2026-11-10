# Diagnostika incidentů Nuki

Upozornění rozlišují pozorování zámku, odpověď Nuki API a veřejný stav služby.
Jedno z těchto pozorování samo o sobě nedokazuje fyzickou poruchu dveří ani
nefunkčnost již ověřeného vstupního kódu.

| Hlášení                                     | Co je zjištěno                                                                                            | Co zkontrolovat                                              |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Nuki hlásí odpojený zámek                   | API odpovědělo a uvedlo `serverState: 4`.                                                                 | Napájení, Wi-Fi a připojení zařízení v aplikaci Nuki.        |
| Nuki Web/API hlásí incident služby          | Veřejný stav hlásí omezení Nuki Web, REST API nebo Remote Access. Zvlášť se zachová stav zámku podle API. | Stav služby; samotný incident není důvodem k restartu zámku. |
| Nuki Web/API vrací chybu služby             | Konkrétní požadavek skončil HTTP 5xx.                                                                     | Službu Nuki; dostupnost zámku tím není ověřená.              |
| Přístup systému k Nuki Web/API není platný  | API vrátilo HTTP 401, 403 nebo 404.                                                                       | Token, jeho oprávnění a ID zámku.                            |
| Nuki Web/API omezuje počet požadavků        | API vrátilo HTTP 429.                                                                                     | Využití limitu; vyčkat na další automatickou kontrolu.       |
| Spojení s Nuki Web/API se nepodařilo ověřit | Timeout nebo síťová chyba bez použitelné odpovědi.                                                        | Připojení systému i službu Nuki. Příčina není potvrzená.     |
| Nuki nepotvrdilo stav připojení zámku       | Neočekávaná odpověď nebo neznámý stav zařízení.                                                           | Odpověď API a zařízení v aplikaci Nuki.                      |

## Kontrola a upozornění

Watchdog kontroluje Nuki nejvýše jednou za pět minut. Stav zámku a veřejný
stav Nuki se čtou nezávisle, paralelně, s limitem pěti sekund na požadavek.
Veřejný stav pochází z `https://status.nuki.io/api/v2/summary.json`; token
Nuki se posílá pouze na `https://api.nuki.io`.

Omezení jiných služeb, například Airbnb, tuto integraci neoznačí za porouchanou.
Nedostupná nebo neplatná stavová stránka znamená „veřejný stav neověřený“;
sama nevyvolá incident, jestliže API potvrzuje připojený zámek. Zelený veřejný
stav nevylučuje problém konkrétního účtu, zařízení nebo požadavku.

Po 15 minutách trvajícího problému vznikne upozornění. Opakované kontroly
aktualizují stejný otevřený incident. Změna diagnózy nebo pozorovaného stavu
zámku aktualizuje jeho titulek, vysvětlení a historii a vyvolá nové upozornění
přes nastavené provozní kanály. Beze změny se upozornění neopakuje. To platí i
pro otevřené incidenty založené před touto úpravou.

Incident se automaticky uzavře po potvrzení připojeného zámku, pokud není
zjištěn veřejný incident relevantní služby. Uzavření incidentu spojení samo
nepotvrzuje dokončení přípravy kódů; to ověřuje každá rezervace zvlášť.

## Rezervace a vstupní kódy

Selhání čtení zařízení nebo oprávnění při přípravě kódu uchová konkrétní
bezpečný důvod v `access_code.failure_reason`. Incident rezervace pak
rozliší chybu API, přístupu, limitu a neověřené spojení. Neznámý stav zařízení
se nevydává za odpojený zámek.

Diagnostika nepřebírá surové odpovědi poskytovatele, přihlašovací údaje ani PINy.
Původní uložený požadavek, pravidla ověření kódu a ochrana před duplicitním
vytvořením zůstávají zachované. Po obnově se dokončuje tentýž požadavek.

## Nasazení a ověření

Není potřeba migrace databáze ani nový token. Pro veřejný stav musí prostředí
umožnit odchozí HTTPS na `status.nuki.io`. Pokud jej neumožní, diagnostika
přizná neověřený veřejný stav a dál použije nezávislé pozorování API.

Testy používají náhrady poskytovatelů a samostatnou lokální databázi.
Pokrývají klasifikaci HTTP a síťových chyb, neplatné odpovědi, omezení jiné
služby, aktualizace a opakované doručení diagnózy, uzavření incidentu i obnovu
přípravy kódu bez duplicitního vytvoření.
