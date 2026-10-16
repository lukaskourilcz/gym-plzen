# Kalendář, blokování termínů a večerní e-mail

Práce na větvi `codex/calendar-blocking-evening` vychází z mainu `bf4b085`.
PR #231 zůstává samostatný. Issues: #232, #233, #234.

## Co je připravené

- První kalendář se vykreslí na serveru. Další den/měsíc načítá veřejné API
  `/api/availability/calendar`, bez CMS a ověřování přihlášení. Pět SELECTů
  v jedné omezené read-only transakci; žádné čištění rezervací nebo provider volání.
- Okamžité zvýraznění, in-memory cache na nejvýše 15 sekund, sdílení souběžných
  čtení, přednačtení dvou sousedních dnů, ignorování starých odpovědí. Realtime
  změny se sloučí a obnoví jen dostupnost. Při chybě nejsou nabízené smyšlené časy.
- Konfigurace Vercelu připravuje `cdg1` u stávající databáze v Paříži.
  Veřejný design se zachovává; obsazené budoucí sloty mají neaktivní stav Obsazeno.
- `/admin/blocking`: šablony a jejich dialogy, aplikace na jednotlivé dny nebo
  včetně posledního dne období, náhled, neměnné dávky, kontrola změněného rozvrhu.
  Při přerušení odpovědi se ověřuje stejná operace, nevytváří se další dávka.
- Rušení maže jen budoucí bloky vlastní dávky. Překrývající rezervace, PINy,
  jiné dávky i ruční blokace se zachovávají. Nepoužívá se služba uzavření termínů.
- E-maily mají samostatnou šablonu `access_code_evening`. Nastavení
  `messages.access_code_evening_from` má výchozí hodnotu 1260 (21:00).
  Rozhoduje začátek rezervace v Praze včetně hranice. Doručovací proces,
  idempotency klíč, platnost kódů, SMS a WhatsApp zůstávají stejné.

## Ověření

Izolované místní databáze `gym_calendar_test`, `gym_calendar_browser_test` a
`gym_calendar_rollout_test` na loopback portu 55439. Náhrady Auth, Resend,
Comgate a Nuki; síťový zákaz skutečných poskytovatelů v testech.

- 299 unit + 202 integračních + 131 prohlížečových testů: 632 prošlo, žádný přeskočený.
- Produkční sestavení, TypeScript, lint a formát prošly.
- SQL kontroly prošly; oba audity závislostí mají 0 zranitelností.
- Prohlížeč naměřil zvýraznění data 7–8 ms, bez RSC navigace; ověřena cache,
  opožděná odpověď, výpadek a retry, historie, více termínů a mobil.
- Ověřeny zimní čas, existující PINy a rezervace, překryvy, souběžná opakování,
  ztracená odpověď, úplný rollback a zákaz zákaznických zpráv při blokování.
- Ověřeny 20:59/21:00, změna hranice, letní/zimní pražský čas a doručený kód,
  který se při další změně nastavení již nerozesílá.

Starší prohlížečové scénáře vybírající dnešní časy nyní používají budoucí den,
aby kontrolovaly stejný nákupní tok i při spuštění po zavírací době.

## Migrace a předání

`drizzle/20261016220000_blocking_templates.sql` přidává dvě neveřejné tabulky
s RLS, vlastnictví dávky na `blocked_slot`, indexy a tři nepoužité šablony.
Nepřidává aktivní bloky, nepřepisuje nastavení a nezapisuje do rezervací,
přístupových kódů ani zpráv.

Zkouška migrace s existujícím ukázkovým uživatelem bez telefonu, rezervací,
PINem a ruční blokací porovnala původní tabulky před i po migraci a prošla.
Vznikly pouze tři šablony, žádná aplikovaná dávka.

Automatické preview této větve je vypnuté. Produkční migrace, sloučení a nasazení
se dosud neprovedly. Před sloučením je určený místní náhled s výhradně ukázkovými
daty. Při schváleném nasazení nejprve aplikovat tuto přidávající migraci,
potom nasadit ověřený commit a pouze čtením zkontrolovat region a dostupnost.
Produkční cíl API pod 500 ms po zahřátí lze potvrdit až po tomto nasazení;
místní odezva neprokazuje produkční síťovou latenci.

## Přímý výběr v Kalendáři (#237)

Kalendář má explicitní režim **Vybrat termíny k zablokování**. Barevné odlišení,
nativní přepínače volných slotů, stavový počet a tlačítko **Uložit blokované
termíny** umožňují vybrat až 200 slotů přes více dnů a týdnů. Údaje pro konkrétní
pohled se načítají až při výběru, samostatně pod přihlášením správce. Při chybě
nejsou nabízeny domnělé volné sloty. Kalendář i server používají Prahu včetně DST.

Nový zápis používá existující `block_application` a `blocked_slot`; žádná další
migrace není potřeba. Pod výhradním zámkem rozvrhu znovu ověří přesné časy,
aktuální otevírací dobu i volnost všech slotů. Kolize odmítne celou dávku;
existující zákaznická rezervace se nikdy neruší. Dávka má neměnnou kopii výběru,
ID operace a záznam v historii. Po nejasném výsledku spojení se ověřuje stejná
operace. Její budoucí bloky lze odebrat v **Blokování termínů**, kde je označena
„Výběr v kalendáři“. Nevznikají zákazníci, rezervace, pipeline, PINy ani zprávy.

Formulář a služba ručních rezervací odmítají nový zcela prázdný kontakt a
odkazují správce na Kalendář. Telefonické rezervace se skutečným kontaktem a
rezervace přiřazených členů fungují dál. Staré rezervace se automaticky
nepřevádějí podle chybějícího e-mailu: absence kontaktu sama o sobě spolehlivě
neprokazuje, že rezervace byla umělou blokací. Žádná produkční data nebyla
při implementaci přepsána, nic nebylo doručeno zákazníkům ani na zámek.
