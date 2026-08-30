# Náměty funkcí z rešerše Mobbin

Aktualizováno: 30. 8. 2026

Rešerše přes Mobbin konektor: fitness a wellness aplikace (Fresha, Open,
Ladder, Gymshark, Nike Run Club, Future, Ten Percent Happier), samoobslužné
rezervační nástroje včetně self-hosted (Cal.com, SavvyCal, Time2book,
HoneyBook) a provozní administrace (Fresha, Jobber, Cal.com Insights). Cílem
bylo najít doplňky pro veřejný web i administraci, obodovat je a doporučit
pět k implementaci.

Žádný námět nezavádí nový obchodní fakt bez souhlasu klienta; kde je potřeba
rozhodnutí vlastníka, je to uvedeno. Vazby na monetizaci viz
[monetization.md](../monetization.md).

## Bodování

Každé kritérium 1–5, součet max. 25:

- **Přínos** — obchodní hodnota (rezervace, retence, provoz);
- **Snadnost** — inverzní pracnost v této architektuře;
- **Soulad** — sedí ke značce NAMASTÉ a design systému;
- **Data** — funguje nad daty, která už systém má;
- **Nezávislost** — nevyžaduje externí kroky ani rozhodnutí klienta.

| #   | Námět                                            | Přínos | Snadnost | Soulad | Data | Nezávislost | Celkem |
| --- | ------------------------------------------------ | ------ | -------- | ------ | ---- | ----------- | ------ |
| 1   | Věrnostní progres k 10. vstupu zdarma            | 5      | 4        | 5      | 5    | 4           | **23** |
| 2   | Potvrzení rezervace+ (kalendář, hosté, navigace) | 3      | 5        | 5      | 5    | 5           | **23** |
| 3   | Administrace „Dnes“ — provozní přehled           | 4      | 4        | 5      | 5    | 5           | **23** |
| 4   | Dárkové poukazy prodávané online                 | 5      | 3        | 4      | 4    | 3           | **19** |
| 5   | Hlídání termínu (waitlist plných dnů)            | 4      | 3        | 4      | 4    | 4           | **19** |
| 6   | „Kdy bývá volno“ — graf vytíženosti              | 3      | 4        | 4      | 3    | 5           | **19** |
| 7   | Dostupnost dnů přímo v pásu kalendáře            | 2      | 4        | 5      | 5    | 3           | **19** |
| 8   | Sekce recenzí na veřejném webu                   | 3      | 4        | 4      | 2    | 2           | **15** |
| 9   | Permanentky / balíčky vstupů                     | 4      | 2        | 4      | 3    | 2           | **15** |

Při shodě 19 bodů dostaly přednost poukazy (přímý příjem) a hlídání termínu
(záchrana poptávky z plných dnů) před čistě informačními náměty 6 a 7.

## Doporučená pětice

### 1. Věrnostní progres k 10. vstupu zdarma (23)

Pravidlo „každý 10. vstup zdarma“ je dnes jen věta na úvodní stránce.
Vizualizovat ho: prstenec či řada 10 lotosů v účtu (`/account`), krátká věta
v potvrzovacím e-mailu („Tohle byl váš 7. vstup…“) a sloupec v administraci
u člena. Zlatý progres na tmavé zelené přesně sedí ke značce.

- Inspirace: [Ten Percent Happier — milníky sezení](https://mobbin.com/screens/68044203-21e9-451e-92a4-4ffe74f85449),
  [Ladder — prstenec progresu](https://mobbin.com/screens/596685a2-58bd-4f29-9766-5fa80836ed48),
  [Nike Run Club — úroveň s milníky](https://mobbin.com/screens/6d298284-0016-475e-b33e-2d67e78515fe),
  [Future — karta 0/12 tréninků](https://mobbin.com/screens/40d9f131-0ea9-428d-8475-39ed457e2135).
- Implementace: služba spočítá dokončené placené rezervace člena, widget v
  účtu + proměnná do e-mailové šablony, bez zásahu do schématu.
- Rozhodnout: co přesně se počítá (dokončená placená rezervace vs. reálný
  vstup dle entry logu) a od kdy se počítá historie.

### 2. Potvrzení rezervace+ — kalendář, hosté, navigace (23)

Na `/rezervace/hotovo`, v detailu rezervace v účtu a v e-mailu doplnit:
„Přidat do kalendáře“ (.ics příloha + Google Calendar odkaz), „Navigovat“
(odkaz na mapy s adresou) a „Pozvat hosty“ — gym je až pro 5 osob, sdílení
termínu přes WhatsApp / Web Share API je přirozený virální kanál.

- Inspirace: [Marriott — dlaždice You're All Set](https://mobbin.com/screens/5acfe95a-673f-4811-a4d1-d85bb53f2770),
  [Grab — potvrzení s mapou a kalendářem](https://mobbin.com/screens/6184757f-a516-462d-bf13-7a43770d25a8),
  [Apple Store — „You and 1 guest“, sdílení](https://mobbin.com/screens/63cc1cbb-36c7-4d38-9a9c-8eefa928f498),
  [Peerspace — potvrzení se správou rezervace](https://mobbin.com/screens/1eff368a-bd8e-4ef8-9eef-8a1390c6b2dc).
- Implementace: route handler generující `.ics`, tlačítka na hotovo stránce a
  v účtu, `.ics` příloha do šablony potvrzení přes Resend. Rychlá výhra bez
  externích služeb.

### 3. Administrace „Dnes“ — provozní přehled (23)

Vstupní stránka administrace jako jednodenní kokpit: dnešní rezervace se
stavem platby, kdo je právě uvnitř (Nuki entry log), dnešní tržba, poslední
události (storna, nové rezervace, selhané webhooky z `alerts`) a mini KPI
řádek za týden (obsazenost, storna) po vzoru Cal.com Insights. Skládá data,
která už administrace má na oddělených stránkách.

- Inspirace: [Fresha — dnešní schůzky a aktivita](https://mobbin.com/screens/d154c2ec-d0e0-45df-b2e4-307d0f2b661b),
  [Jobber — pozdrav, dnešek, feed](https://mobbin.com/screens/56a6ce1c-8d71-4c1a-89cb-1d07f075424a),
  [HoneyBook — přehled plateb](https://mobbin.com/screens/bc493c08-888d-42fb-8670-32495d9841f4),
  [Cal.com — booking insights](https://mobbin.com/screens/8309eb7c-94a9-4f8e-99b5-a721ba773eaf).
- Implementace: nový admin modul čtoucí existující služby (rezervace, entry
  log, platby, alerts); žádná nová integrace.

### 4. Dárkové poukazy prodávané online (19)

Administrace `/admin/vouchers` už existuje; chybí veřejná stránka, kde
poukaz koupí zákazník: částka či počet vstupů, jméno obdarovaného, věnování,
odeslání hned nebo v zadaný den, e-mail s poukazem v brandu (tmavá zelená +
zlatá jako u sweetgreen). Uplatnění kódem v kroku platby rezervace. Silná
sezóna: Vánoce.

- Inspirace: [HelloFresh — nákup a uplatnění poukazu](https://mobbin.com/flows/8a06fcb0-24f0-40ab-b05d-73ff2586472e),
  [sweetgreen — motivy, náhled, načasování](https://mobbin.com/flows/9bcf4c50-2158-413e-bd8e-db5c4c895827),
  [DoorDash — přednastavené částky a náhled](https://mobbin.com/flows/f903ac1f-f8f2-4697-b56b-4e252f37d48b).
- Implementace: veřejná route `/poukazy` → Stripe Checkout → vydání poukazu
  ve stávající voucher službě → nová Resend šablona; pole „Mám poukaz“ v
  rezervaci.
- Rozhodnout (viz monetization.md): expirace, storno a účetní pravidla,
  nabízené částky; doplnit VOP.

### 5. Hlídání termínu — waitlist plných dnů (19)

Jediný slot v čase znamená, že plné dny odhánějí poptávku. U obsazeného dne
nabídnout „Pohlídat termín“: zákazník zadá den + rozmezí časů a kontakt,
při stornu (storno tok už existuje) dostane e-mail/WhatsApp s odkazem na
rezervaci uvolněného slotu. Admin vidí frontu zájemců u dne.

- Inspirace: [Fresha — „Join the waitlist“ pod sloty](https://mobbin.com/screens/9ed7eb7a-41ca-4528-a891-9ffb44f60dcf),
  [Resy — Notify s rozmezím časů](https://mobbin.com/screens/9668166e-2287-4708-aebc-236edbba6e69),
  [Too Good To Go — jednorázová vs. opakovaná notifikace](https://mobbin.com/screens/b150bbef-7886-411f-b371-87328b80b0b4).
- Implementace: nová tabulka hlídaných termínů + napojení na storno službu,
  notifikace přes stávající Resend/WhatsApp adaptéry, úklid cronem.
  Pořadí „kdo dřív klikne“ místo držení slotu zjednoduší souběhy.

## Další náměty (pod čarou)

- **„Kdy bývá volno“ (19)** — sloupcový graf vytíženosti dne po vzoru
  [IKEA popular times](https://mobbin.com/screens/dc59060c-57cf-4ffb-bbae-48fb4df27fa8)
  a [Oura](https://mobbin.com/screens/3e211f3f-a95d-4478-ac8c-4153e3f91501);
  smysluplné až s delší historií rezervací, jinak graf lže.
- **Dostupnost dnů v pásu kalendáře (19)** — počty volných slotů u dní po
  vzoru [Time2book](https://mobbin.com/screens/218acec2-04d6-4791-b6c1-38cab613a1c2)
  a [Cal.com](https://mobbin.com/screens/5cc79401-5300-4436-86d2-a909f6d45ac7);
  kalendář ale klient právě odsouhlasil, měnit ho teď je zbytečné riziko.
- **Recenze (15)** — karusel hvězdičkových karet po vzoru
  [Fresha](https://mobbin.com/sites/sections/87e75ad4-aa7a-4e06-90fe-745e63ed1631)
  a tmavých karet [Origin](https://mobbin.com/sites/sections/ec1ec3ad-5b9b-4dcb-8210-a3b408cfc5cf);
  čeká na skutečné recenze (nesmí se vymýšlet), např. import z Google.
- **Permanentky (15)** — zůstatek kreditů po vzoru
  [Klook](https://mobbin.com/screens/33536290-c3c9-41e6-9e7c-84edc8824777);
  dle monetization.md až po ověření poptávky reálným provozem.
