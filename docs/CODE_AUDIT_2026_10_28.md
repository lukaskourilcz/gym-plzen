# Audit celé aplikace — 28. října 2026

Issue #282. Výchozí commit: `f9b35c4c3ba3b485e413ba96fd5f992325111a5e`
(samostatně schválené a sloučené PR #281). Audit a jeho opravy zůstávají na větvi
`codex/application-audit-2026-10-28`; nejsou schválené pro merge ani nasazení.
Automatické Vercel preview této větve je vypnuté. Testy používají výhradně
oddělené místní databáze a náhrady poskytovatelů s blokováním vnější sítě.

## Mapa pokrytí

Inventář a předchozí audit nejsou důkazem nové kontroly. Stav se doplňuje až
po přečtení celých kritických toků, ověření jejich volajících a konkrétních testů.

| Oblast                  | Provedená kontrola a důkazy                                                                                                                                                                                                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identita, role a profil | Trasy login/callback/confirm/reset, middleware, guards/demo-policy, customer-profile/password a změny rolí. Role pochází z profiles, Auth metadata nejsou autorita. E2E auth/customer/required-phone/admin + A03.                                                                                |
| Rezervace a kapacita    | Celé orders/booking/availability/order-state a jejich volající, createReservation, slots/schedule, blocking/calendar-blocking/closures. Exclusion constraint, zámek rozvrhu a kontrola po zámku; integrační orders/reservations/admin-operations/blocking + SQL.                                 |
| Změny a storna          | priced-rescheduling → rescheduling → credit-change-state, finance-guard, abort/recovery, reservations/cancellation-delivery. Původní a nový čas se drží do ověření přístupu; compensation/refund má trvalý intent. Integrační repricing/rescheduling/credit-change/cancellation + A05/A09.       |
| Peníze a kredity        | payments včetně všech čtyř dispatcher větví, order-state, credits/credit-admin, vouchers/loyalty/memberships, snapshot nákupních podmínek. Dedupe, částka/měna/merchant/environment, rezervace kreditů a immutable ledger; integrační concurrency/late/unknown/refund scénáře.                   |
| Kódy a zámek            | Celý access-codes/fulfillment/pipeline/operation-lock, Nuki readback/ambiguous PUT/revoke/expiry, lock-health, entry-log a autorizované PIN projekce. Příprava −24 h, doručení −1 h, nezávislost na nové otevírací době; fiktivní Nuki integrační testy.                                         |
| Komunikace a dokumenty  | notifications a trvalé outboxy cancellation/reschedule/invoice/operator, transporty, archive/messages, invoices/PDF. Exact bytes, dedupe a bezpečná retry lhůta, povinný email versus volitelný WhatsApp; A05/A06/A07.                                                                           |
| Vnější vstupy a úlohy   | Inventář všech 22 route handlerů (17 API) a 24 action modulů. Podpisy, tajemství cron, body limity, OAuth state, autorizace PDF/ICS, veřejná projekce dostupnosti, retry a fronty. E2E/integrační routes, webhooks, outage/recovery; A07/A09.                                                    |
| Web, obsah a média      | CMS text/asset allowlist, escapování šablon/JSON-LD, newsletter consent/unsubscribe HMAC, upload podle obsahu/rozměrů, Instagram OAuth/vault/image allowlist/cache/deauthorize, právní texty a analytický souhlas. Public/content/Instagram/analytics E2E + media/OAuth/ICS jednotkové kontroly. |
| Administrace a náhledy  | Každý admin page má vlastní requireAdmin, každá mutace authorize/assertAdmin. Filtry mají allowlist SQL řazení a escapované LIKE; member notes jsou pouze admin. Customer-preview používá místní stav bez DB/provider zápisů; E2E průchody, A02/A08/A11.                                         |
| Databáze a migrace      | Celá historie aplikovaná na nové izolované DB, RLS/GRANT/execute/search_path a immutable evidence ověřují SQL testy. Nový index testován proti starým i finančním datům; concurrency, překryvy, DST a inkluzivní období v integračních testech. A04/A10.                                         |
| Výkon a dostupnost      | Veřejné availability snapshoty, 15s cache, coalescing/invalidation/stale response/keyboard/history, read-only retry a DB/provider timeouts. Syntetický profil 50 500 rezervací, měření FK i přenosu historie; A04/A08.                                                                           |
| Závislosti a provoz     | Reprodukovaná instalace z lockfile, 0 npm advisories po A01, CI permissions/read-only, podporovaný Node 22, cdg1 deployment ověřen u PR #281. Audit branch má Vercel deploy vypnutý. Externí omezení a provozní nastavení viz níže.                                                              |

Kontrola je založená na trasování kritických toků, všech vstupních hranic a
uvedených regresích. Není tvrzením, že každá ze 446 TS/TSX implementací byla
ručně přečtena řádek po řádku. Transitivní graf 81 klientských vstupů (191
interních modulů, s ukončením na server actions a vyloučením type imports)
nenašel cestu k DB, serverovému env ani modulu označenému server-only.

## Výchozí ověření

PR #281 před sloučením: oba GitHub Actions běhy úspěšné, 335 jednotkových,
281 integračních a 168 prohlížečových testů; SQL oprávnění/neměnnost historie,
build, typy, lint a formátování prošly. Čtyři nízké npm advisories z řetězce
Resend/deepmerge jsou známý podnět pro tento audit, nikoli výjimka z CI prahů.

## Nálezy, opravy a měření

Doplní se pouze reprodukované nálezy, jejich dopad a regresní důkazy. Zelená
sada testů neznamená záruku absence všech chyb ani externí penetrační test.

### A01 — Nepoužívaný SDK přinášel zranitelný řetězec závislostí (P3)

`resend` SDK není importován v aplikaci ani testech. Doručování používá vlastní
časově omezený HTTP transport `resend-transport.ts`, včetně idempotency klíčů a
klasifikace neznámé odpovědi. Odstranění nepoužívaného balíčku eliminuje SDK i
jeho tranzitivní React renderer/html-to-text/deepmerge a čtyři advisories
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
Audit lockfile po odstranění: **0 zranitelností**, bez vypnutí bezpečnostních
kontrol nebo změny transportu/zpráv. Prokázaný nález je zranitelná závislost;
zneužitelná cesta přes skutečné doručování v této aplikaci nebyla prokázána.

### A02 — Ruční rezervace vybraného člena zahazovala kontakty (P2)

Formulář dovoluje pouze `userId`, ale služba zapisovala NULL kontakt a následný
fulfillment pracuje s kontaktem rezervace. Reprodukce selhala na očekávaném
e-mailu člena. Nová ruční rezervace přebírá známé jméno/e-mail/telefon jen tam,
kde správce nepředal vlastní kontakt. Staré rezervace se nedoplňují, samotné
uložení nic neposílá. Čtyři scénáře ručních rezervací po opravě prošly.

### A03 — Netextové jméno z Auth metadata shodilo účet (P2)

Zákazník může měnit metadata své identity; `full_name` se nebezpečně přetypovalo
na string. S objektem a prázdným profilovým jménem `/account` končil TypeError
`trim is not a function`. Guard nyní přijímá jen text, jinak použije profil nebo
e-mail. Browser regresní scénář navíc ověřuje, že metadata `role: admin`
nezmění databázovou roli ani nepovolí administraci.

### A04 — Mazání dočasné blokace procházelo finanční historii (P2)

Cizí klíč `reservation_change.block_id` neměl podpůrný index. S 110 000 výhradně
fiktivními řádky dotaz pro kontrolu vazby četl celou tabulku (2445 bufferů;
první diagnostické měření 137,562 ms). Nový částečný index používá index-only
scan, 2 buffery a 0,015 ms. Nejde o produkční časové měření ani garantovaný
násobek zrychlení. Migrace obsahuje pouze CREATE INDEX, žádný backfill či seed.
Migrační test zachoval původní rezervace/PINy a také existující finanční ledger,
rezervovaný kredit, připravenou platbu, blokaci a doručovací záznamy.

### A05 — Opakování admin storna nemělo stejné záruky jako zákaznické (P1)

Tři regresní scénáře nejprve selhaly: po ztracené přijaté odpovědi a editaci
šablony vznikl konflikt idempotency klíče; po 23 hodinách se znovu POSTovalo;
u staré neznámé odpovědi bez původních bajtů se zpráva znovu sestavovala.
Nová admin storna mají stejně jako zákaznická atomický verzovaný intent,
zmrazené bajty před providerem a 23hodinovou bezpečnou hranici. Historická
nepotvrzená storna bez spolehlivého intentu se předají k ručnímu ověření,
nikoli k novému sestavení/odeslání. Osm integračních scénářů po opravě prošlo.
Status již zrušené rezervace a stávající kódy tato oprava sama nemění.

### Samostatně dokončený release PR #281

Produkční Vercel deployment `dpl_2vmZL4ojDyCZV1avakfwi2M9PY5w` je READY,
main commit `f9b35c4c3ba3b485e413ba96fd5f992325111a5e`, region `cdg1`, doména
`www.navigym.cz`. Žádná migrace ani auditní oprava se do tohoto release nepřidala.
Následné ověření používá pouze veřejné GET pro úvodní stránku, dostupnost a
podmínky; žádné potvrzovací/platební URL, cron, zásah do zámku nebo testovací nákup.

### A06 — Retence mazala archiv, ale ponechávala kopie e-mailů v outboxu (P2)

Neúspěšné outboxy uchovávaly zmrazené HTML a případné přílohy i po 30 dnech,
kdy administrace slibuje odstranění uloženého obsahu. Reprodukce prokázala
ponechané tělo právě na hranici retence. Úklid nyní atomicky odstraní archiv
a staré emailové payloady. Zachovává klíče deduplikace, ID poskytovatele,
stavy, časy i údaje jiných kanálů pro jejich reconciliaci. Outboxy už v této
chvíli dávno překročily 23hodinovou hranici automatického odesílání. Regresní
test ověřuje hraniční čas, novější obsah, WhatsApp metadata a opakovaný úklid.

### A07 — Vadná položka WhatsApp webhooku blokovala celou dávku (P2)

I správně podepsané JSON `null` nebo objekt namísto pole končily 500. Neplatný
čas v první položce zabránil zpracování dalších platných potvrzení; neznámý
stav se navíc překládal jako „odesláno“. Dva regresní testy nejprve selhaly.
Obálka se nyní validuje před zápisem, vadné jednotlivé stavy se izolují,
neznámý stav se nevymýšlí a podepsané platné potvrzení se zapíše. Šest testů
vnějších rout prošlo; fiktivní podpisový klíč nevytváří oprávnění odesílat.

### A08 — Stránka kódů přenášela nesouvisející historii pokusů (P2)

Pro každou stránku se stahovaly všechny historické neúspěšné pokusy, přestože
UI potřebuje detaily jen pro viditelné kódy a celkový počet nepřiřazených pokusů.
Na izolovaném fixture 5 003 vstupů původní dotaz přenesl 5 002 řádků / 685 343 B;
nový vrací 2 řádky / 343 B a SQL souhrn se stejným počtem 2 500. Jednorázové
lokální měření celé funkce: 27,90 → 9,05 ms (bez tvrzení o produkční latenci).
Regrese ověřuje úplné použití i selhání viditelného kódu, prázdnou stránku,
správný souhrn a zachování celé uložené historie. Neomezuje se historie kódu,
jen se nečtou a neserializují cizí podrobnosti.

### A09 — Fronta opuštěných změn mohla trvale držet neuhrazený termín (P2)

Po pádu procesu před vložením platby má watchdog opuštěnou změnu uvolnit.
Dotaz ale nejprve omezoval všechny prošlé změny na deset a teprve poté hledal
ty bez platby. Jedenáct starých nejistých plateb tak vyhladovělo další osiřelý
záznam; reprodukce ponechala stav awaiting_payment. Filtr NOT EXISTS je nyní
před LIMIT, s deterministickým pořadím; druhá kontrola pod zámkem zůstává.
Regrese prokazuje uvolnění pouze osiřelé blokace a jejího kreditu, zachování
11 nejistých pokusů, všech rezervací, připravených kódů, plateb i ledgeru.
Opakování nezakládá platbu, refundaci ani zákaznickou zprávu.

### A10 — Test bootstrap nerozpoznal chybné kódování databáze (P3, testovací prostředí)

Při přípravě nových místních databází zdědil pracovní PostgreSQL výchozí
SQL_ASCII. Toto neplatné testovací prostředí nesmí být podkladem pro závěr
o produkci (UTF8). Závěrečné databáze byly
vytvořeny z template0 explicitně jako UTF8. Bootstrap nyní ještě před migrací
odmítá jiné kódování; regresní test ověřuje prázdné schéma po odmítnutí.
Tím se neskrývají chyby vyhledávání a budoucí chybný lokální běh selže včas.

### A11 — Hledání jmen záviselo na locale a neumělo obecné latinské akcenty (P2)

Opakovaný běh na UTF8 s locale C prokázal samostatnou chybu aplikace: SQL
lower neodstraňovalo velká česká písmena, ruční translate neuměl například
Müller ani rozložené E + akcent. Prohlížeč přitom dotaz normalizuje jako NFD.
Společný SQL výraz nyní nejprve provede NFD a odstraní kombinující latinské
akcenty, poté převede ASCII na malá písmena. Používají ho všechny admin seznamy
i kredity; původní data a nastavení databáze zůstávají beze změny. Regrese
ověřuje ŽLUŤOUČKÝ, Zoë Müller a rozložené ÉLODIE v obou seznamech. Funkce je
nativní v PostgreSQL 17, bez nové extension nebo migrace:
[PostgreSQL string functions](https://www.postgresql.org/docs/17/functions-string.html).

## Výkon — izolovaná reprezentativní data

Benchmark `scripts/profile-launch-audit.ts`, PostgreSQL 17, UTF8/C, místní síť:
50 500 rezervací, 50 000 plateb, 50 000 zpráv, 5 000 nákupů jednoho ukázkového
člena. Před/po běhu souhlasily počty všech tří tabulek. Časy jsou diagnostická
měření konkrétního stroje; nezaručují stejnou produkční latenci.

| Tok                            | SQL statements včetně transakční režie | Celá funkce |
| ------------------------------ | -------------------------------------: | ----------: |
| Měsíc slotů                    |                                     15 |       51 ms |
| Jedna dostupnost               |                                      2 |        2 ms |
| Statistiky celé historie       |                                      1 |       55 ms |
| Finance                        |                                      7 |       15 ms |
| Stránka nákupů zákazníka       |                                      5 |       10 ms |
| Poslední zprávy                |                                      1 |        2 ms |
| Zítřejší přehled bez rezervací |                                      1 |        2 ms |

PR #281 po nasazení: veřejná dostupnost pro zahřáté požadavky 324 a 244 ms.
Žádná auditní oprava se v těchto produkčních číslech neuplatnila. Novější
profil bude potřeba znovu změřit až po samostatném schválení auditního release.

## Záměrně nezměněná provozní nastavení a omezení

- Produkční Supabase security advisor hlásí vypnutou ochranu proti uniklým
  heslům. Audit její aktivaci připravuje jako provozní doporučení; uživatel
  zakázal nasazení auditních změn, proto se Auth konfigurace nemění.
  [Supabase password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- INFO RLS-enabled/no-policies u serverových tabulek znamená úmyslně zamítnutý
  klientský přístup, nikoli důvod přidat veřejné policies. Oprávnění ověřuje
  samostatná SQL sada. INFO unused-index a ostatní FK indexy nejsou automaticky
  označené za chybu bez měření příslušného toku; měřená vazba A04 je opravena.
- Reálná doručitelnost do schránek, chování fyzického Nuki během dlouhého
  výpadku, živé Comgate refundace, Meta granty a heartbeat poskytovatele se
  záměrně nevyvolávaly. Testy ověřují smlouvy s náhradami poskytovatelů.
- Lokální omezení počtu požadavků zůstává doplňkem ochrany infrastruktury,
  nikoli distribuovanou zárukou mezi všemi serverless instancemi.
- Nová auditní migrace vytváří pouze částečný index. CREATE INDEX může po dobu
  sestavení zdržet zápisy do reservation_change; před budoucím samostatným
  nasazením je nutné zkontrolovat její velikost a zvolit přiměřené provozní okno.
  Žádný zákaznický řádek, kód, seed, trigger ani fronta se migrací nepřepisují.
- Případný rollback auditní aplikace ponechá finanční ledger a idempotency
  záznamy. Nový index lze ponechat; pro rollback kódu není potřeba nic mazat.
