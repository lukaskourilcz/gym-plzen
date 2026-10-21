# Přehledná změna a zrušení rezervace — návrh

Stav: implementováno v PR #256 v návaznosti na issues #257 a #258. Změny
se aktivují až po nasazení a po výslovné zákaznické akci. Nasazení samo
nepřepisuje rezervace, kódy, historická storna ani uložené e-mailové šablony.
Není potřeba datová migrace. Testy používají výhradně místní oddělené databáze
a náhrady poskytovatelů.

## Ověřený současný stav

- Potvrzenou rezervaci svého účtu lze změnit jednou, nejpozději 24 hodin
  před začátkem. Přesná hranice 24 hodin je ještě povolená. Kontrola probíhá
  v rozhraní i znovu na serveru při zápisu.
- Zrušit lze vlastní potvrzenou rezervaci před začátkem. Podle současného
  pravidla se platba nevrací ani při zrušení dříve než 24 hodin předem.
  Po začátku nejsou zákaznická změna ani storno dostupné.
- Storno již má dvoukrokové potvrzení a obnovu fokusu. Oznámí nevrácení platby,
  zneplatní příslušný kód a uvolnění nesmí obejít ověření odebrání na zámku.
- Nové zákaznické storno ukládá ve stejné transakci i záměr potvrzovacího
  e-mailu. Používá samostatnou editovatelnou šablonu „Zrušení rezervace
  zákazníkem“. Storna administrací a jejich již existující fronta zachovávají
  původní šablonu. Historická zákaznická storna žádnou novou frontu nedostanou.
- Ostrý formulář již má u jednotlivých termínů „Odebrat“. Obrázek klienta
  pochází z administrátorského zákaznického náhledu, kde tato možnost chyběla.
  Tato větev ji do simulace doplňuje, zachovává rozepsané údaje a přepočítává
  cenu i odměnu. Bonus označí „Bonusový 10. vstup zdarma“ podle příznaku odměny,
  nikoli podle samotné nulové ceny.

Zdroje: `src/lib/services/rescheduling.ts`, `src/lib/services/reservations.ts`,
`src/lib/services/cancellation-delivery.ts`, `src/lib/config/email-templates.ts`,
`src/app/account/page.tsx`, `src/app/rezervace/udaje/page.tsx`,
`src/app/customer-preview/customer-preview.tsx`.

## Můj účet → Moje rezervace

Výchozí pohled „Nadcházející“, vedle „Historie“. Jeden termín = jedna kompaktní
karta. Na první pohled datum, čas, stav a cena; pod nimi jasná tlačítka
„Změnit termín“ a méně výrazné „Zrušit rezervaci“. Na telefonu zůstanou tlačítka
snadno dostupná pod termínem. Nedávno zrušený termín se přesune do historie se
stavem „Zrušeno zákazníkem“, cenou a informací „Platba se nevrací“.

Příklad obsahu karty:

> Pátek 23. října · 10:00–11:15 · Potvrzeno · 199 Kč
>
> Změna zdarma do 22. října 10:00. Termín můžete změnit jednou.
>
> **Změnit termín** · Zrušit rezervaci

Po uplynutí lhůty zobrazit místo zmizelého tlačítka jasné vysvětlení:
„Do začátku zbývá méně než 24 hodin. Termín už nelze změnit.“ Při vyčerpané
změně „Tento termín jste již jednou změnili.“ Storno zůstane dostupné do začátku.

## Změnit termín

1. Kliknutí z konkrétní karty otevře přehledný výběr data a času. Nahoře trvale
   zůstane původní termín a poznámka „Původní rezervace platí až do potvrzení změny“.
2. Použít známý veřejný kalendář s lehkým načítáním dostupnosti, ale v režimu
   výběru jediného náhradního termínu. Zachovat pravidla rozvrhu, blokací,
   cenové politiky již zaplaceného vstupu a aktuálního serverového přesunu.
3. Po výběru zobrazit „Z … → Na …“ a tlačítko „Potvrdit změnu termínu“.
   Vrácení či zavření výběru nic nemění. Neposílat zákazníka do nového nákupu.
4. Při konfliktu zobrazit „Tento čas mezitím někdo rezervoval. Vyberte jiný.“
   Původní termín zachovat. Při nejistém stavu zámku ukázat skutečný stav
   ověřování, nikdy předčasný úspěch.
5. Po úspěchu aktualizovat kartu a ukázat potvrzení. Stávající mechanismus
   zajistí odpovídající kód a jediné potvrzení změny e-mailem.

Nezavádět druhou implementaci přesunu. Opřít nové ovládání o současnou službu,
kontrolu vlastnictví, limity změny a zámky rozvrhu/rezervace. Časy zobrazovat
v Praze, lhůtu počítat jako skutečných 24 hodin i při změně letního času.

## Zrušit jednu rezervaci

Dialog zobrazí konkrétní datum a čas, částku a přímé vysvětlení:

> Opravdu chcete tento termín zrušit? Termín se uvolní pro ostatní a vstupní
> kód přestane platit. **Zaplacených 199 Kč se nevrací.**

Tlačítka „Ponechat rezervaci“ a „Zrušit bez vrácení platby“. Pod 24 hodinami
navíc výslovně „Do začátku zbývá méně než 24 hodin; změna termínu už není možná“.
Dříve nabídnout přednostně odkaz „Raději změnit termín“. Pro bonusový vstup
nepsat o vracení zaplacené částky: vysvětlit skutečné stávající pravidlo spotřeby
odměny po jeho ověření v implementaci věrnosti. Neslibovat nový bonus automaticky.

Storno jedné položky vícetermínové objednávky nikdy nezruší ostatní položky,
jejich kódy, platbu či doklady. Neprovádět žádnou automatickou refundaci.
Opakovaný klik či obnova stránky nesmí vyvolat další storno ani další e-mail.

## E-maily → „Zrušení rezervace zákazníkem“

Přidat novou editovatelnou šablonu pouze pro budoucí zákaznická storna.
Zachovat společnou dosavadní šablonu pro storna administrací. Nová varianta
bude obsahovat jméno, konkrétní datum a čas, cenu a větu o nevrácení platby.
Předmět „Potvrzení zrušení rezervace | NAVI Private Gym“. V těle jasně uvést,
že storno potvrdil zákazník a že kód již nelze používat. Pro nulový bonus
použít samostatnou pravdivou větu, nikoli „vrácení 0 Kč“.

Výběr nové šablony uložit s operací (případně do trvalých metadat doručení),
aby opakování odeslání zachovalo typ zprávy. Zachovat stávající deduplikační
klíč `cancellation/<reservationId>` a mechanismus opakování při výpadku.
Žádné zpětné odesílání historickým stornům a žádné hromadné přepisy šablon.

## Rekapitulace před platbou

Každý řádek bude mít datum, čas, cenu a vlastní „Odebrat“ s přístupným názvem
konkrétního termínu. Celková cena se přepočítá včetně slev, voucheru, doprovodu
a věrnosti; ověření ceny vždy proběhne na serveru před vytvořením/změnou držení.
Zachovat vyplněné údaje zákazníka. Po odebrání posledního termínu nabídnout
návrat do kalendáře, neponechat aktivní tlačítko pro platbu prázdné objednávky.

Nulový vstup označit **„Bonusový 10. vstup zdarma“** jen tehdy, pokud je
skutečně přiznanou věrnostní odměnou. Nulovou cenu z voucheru nebo jiné akce
nikdy za desátý vstup neoznačovat. Po odebrání položky může odměna připadnout
jinému termínu; označení musí vycházet z nového výpočtu, ne z původního indexu.

Při existujícím nezaplaceném držení použít současné bezpečné nahrazení držení.
Souběžně zaplacená objednávka se nesmí uvolnit ani přepočítat. Neodstraňovat
položky již zaplacené objednávky cestou editačního formuláře před platbou.

## Provedení a ověření

1. Samostatný issue/commit pro přehled účtu a jednoznačnou změnu termínu.
2. Samostatný issue/commit pro dialog storna a samostatnou šablonu doručení.
3. Samostatný issue/commit pro odebrání z rekapitulace a popis bonusu.
4. Testy hranice 24 h (včetně přesného okamžiku), druhé změny, vlastnictví,
   souběžně obsazeného cíle, výpadku Nuki/e-mailu, opakování a skutečně
   potvrzeného odebrání kódu. U objednávek ověřit nedotčené sourozenecké položky.
5. Otestovat bonusový/nebonusový nulový vstup, odebrání před/za odměnou,
   odebrání posledního termínu, voucher, více slotů a souběh s úhradou.
6. Ověřit mobilní ovládání, klávesnici, návrat fokusu a zachování údajů.
   Databáze a všichni poskytovatelé pouze izolovaní; žádné produkční storno,
   přesun, zpráva ani zkušební platba. Nasazení až po schválení výsledku.

## Technické provedení

- `src/lib/config/rescheduling.ts`: jediné sdílené pravidlo způsobilosti pro UI
  i zápis. Stávající služba přesunu a ochrany Nuki se nemění.
- `src/app/account/reservation-card.tsx` a `reservation-actions.tsx`: karty,
  aktuální lhůty a důvody nedostupné změny; historie čte pouze rezervace
  přihlášeného uživatele, po 20 záznamech.
- `src/components/ui/dialog.tsx`: veřejný nativní dialog, bezpečná výchozí
  volba ponechat termín, obnova fokusu a zákaz zavření během zápisu.
- Kalendář přesunu používá stejný patnáctisekundový veřejný cache/hook a API
  jako nový nákup. Realtime zneplatní dostupnost bez obnovy celého účtu.
  O konečné dostupnosti i přesunu rozhoduje původní služba na serveru.
- Zákaznické storno uloží typ šablony a proměnné do stávajícího JSON pole
  fronty. Před prvním pokusem uloží přesné znění e-mailu. Opakování používá
  stejné bajty i stejný deduplikační klíč, i když správce mezitím šablonu změní.
  Po 23 hodinách se nejisté odeslání předá k ověření; automaticky znovu neodejde.
- Již dokončené zákaznické storno je při opakování bez dalších zápisů,
  zpráv, auditních duplicit nebo opakovaného odebrání kódu.
- Zrušený bonus není započítaným vstupem. UI ani e-mail neslibují okamžité
  vrácení bonusu; vysvětlují přepočet nároku podle zbývajících rezervací.
