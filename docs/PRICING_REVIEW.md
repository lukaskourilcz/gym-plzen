# Ceny bloků a doprovod: podklad před mergem

Větev: `codex/block-pricing-guests`. Výchozí stav GitHub `main`:
`af017baa734728decbfbaf5ced61ae2512793a19`.

## Chování

- **Administrace → Ceník a doprovod:** vybrat den, první a poslední blok
  (poslední včetně) a cenu za jeden blok pro jednoho dospělého. Časy vycházejí
  z databázového rozvrhu. Volitelně uložit stejnou cenu pro všechny otevřené
  dny se shodnými bloky, v jedné transakci. Překryv cen se odmítne.
- Cena konkrétního bloku má přednost před cenovým obdobím a standardní cenou.
  Po změně otevírací doby se nezarovnané cenové rozsahy viditelně označí a
  přestanou platit, dokud je správce neopraví. Nic se automaticky neposouvá.
- **Doprovod:** výchozí 100 Kč společně za +1 nebo +2 osoby. Správce může
  změnit částku i výpočet na cenu za každou další osobu. Příplatek se počítá
  za každý zakoupený blok. Věrnostní odměna pokryje základní vstup;
  doprovod se hradí i u tohoto vstupu. Voucher se uplatní na cenu objednávky.
- Před rezervací je povinná volba sám/sama, +1 nebo +2. Server cenu znovu
  vypočítá. Rozpracovaná platba si zachovává svůj původní počet osob a cenu.
- **Můj účet:** „Přidat osobu“ u vlastního budoucího potvrzeného termínu,
  také v historii objednávek. Doplatek vychází z aktuálního nastavení pouze
  pro nově přidané osoby. Při jednotném příplatku je přechod +1 → +2 bez
  další platby. Změnu ceny od otevření formuláře server odmítne a požádá
  o obnovení stránky.
- Placení dodatečného doprovodu má vlastní záznam a vlastní platbu. Počet lidí
  se změní až po ověřené platbě. Dvojí odeslání pokračuje ve stejné platbě;
  opakovaný callback přidá osoby pouze jednou. Neznámý výsledek založení
  platby blokuje další pokus. Neúspěšný doplatek neruší původní rezervaci.
- Pozdní nebo neplatná úhrada se označí ke kontrole/refundaci, bez obnovení
  zrušené rezervace. Při stornu provozovatelem zahrnuje upozornění k vrácení
  i zaplacené doplatky za doprovod. Aplikace sama peníze nevrací.
- Dodatečné přidání nemění čas, původní cenu/platbu/doklad ani vstupní kód;
  nespouští fulfillment ani další e-mail. Účet ukazuje doplatek samostatně.
- Kalendář a detail rezervací zobrazují `+1`/`+2`. Jednotlivec má v kalendáři
  původní podobu názvu.
- Apple Design je omezen na administraci: systémové písmo, seskupená navigace,
  rozbalovací další nástroje a jemná okamžitá odezva. Veřejná typografie,
  rozvržení a společné komponenty se nepřestylovávají. FAQ pouze vysvětluje
  nový příplatek; zastaralý přesný výchozí text se již nepoužije.

## Ověření

Ověřeno na Node.js 22.23.3, ve vlastním lokálním Postgresu a s lokálními
náhradami Auth, Comgate a Resend. Testovací server odmítá externí požadavky.
Nebyly použity ostré přihlašovací údaje ani měněny skutečné rezervace.

- Formát, lint, typová kontrola a produkční sestavení: prošly.
- Jednotkové testy: 282 prošlo.
- Integrační testy: 178 prošlo, včetně 16 scénářů nových cen a doprovodu.
- Prohlížečové testy: 115 prošlo, včetně přístupnosti, cenového editoru,
  skutečného objednání s doprovodem, doplatku a `+2` v kalendáři.
  Po poslední úpravě mobilního zobrazení zopakovány všechny čtyři scénáře
  `pricing-participants.spec.ts` s novým produkčním sestavením: 4 prošly,
  lokální náhrada mailové služby zaznamenala 0 zpráv.
- SQL omezení: prošla, včetně nejvýše +2 osob, jednoho rozpracovaného
  doplatku, jedné platby, oddělení od původní platby a RLS/zákazu Data API.
- Migrace vyzkoušena i na naplněné lokální databázi: všechny původní hodnoty
  rezervací a plateb, dostupnostní signály a počty zpráv/kódů zůstaly stejné.
- Produkční audit závislostí: 0 nálezů.
- Úplný audit a tím i GitHub CI blokuje existující
  [#204](https://github.com/lukaskourilcz/gym-plzen/issues/204): vývojový řetězec
  ESLint → fast-glob → micromatch → braces, 5 high položek v auditní agregaci.
  Neproveden vynucený downgrade a audit nebyl skryt ani vypnut.

## Před nasazením

Lokální náhled na `http://127.0.0.1:3132` používá vlastní databázi
`gym_preview_test` a pouze fiktivní účty/rezervace. Přihlášení pro správce:
`admin@preview.example.test`, pro zákazníka: `klient@preview.example.test`.
Oba mají ukázkové heslo `Nahled2026!`; nejde o produkční přístupové údaje.
Auth, platby a mailová služba jsou lokální náhrady a server odmítá externí
požadavky. Náhled žije jen po dobu běhu lokálního procesu.

Merge do `main` čeká na kontrolu náhledu vlastníkem. Pro tuto pracovní větev
je automatické Vercel nasazení vypnuté. Nastavení produkčních služeb se neměnilo.

Před nasazením kódu bude nutné aplikovat migraci
`drizzle/20261014130000_participant_additions.sql` běžným spravovaným postupem.
Je pouze doplňující: nové sloupce s bezpečnými výchozími hodnotami, nová
serverová tabulka a vazba doplatku v platbě. Neobsahuje `UPDATE reservation`
ani nové notifikační triggery. Na produkci zatím nebyla spuštěna.

Historické rezervace nemají evidenci skutečného doprovodu; nic se u nich
zpětně nedopočítává. Původní rezervace, ceny, kódy a doklady zůstávají zachované.
