# Ceny bloků a doprovod: podklad před mergem

Větev: `codex/block-pricing-guests`. Výchozí stav GitHub `main`:
`af017baa734728decbfbaf5ced61ae2512793a19`.

## Chování

- **Administrace → Ceník a doprovod:** vybrat den, první a poslední blok
  (poslední včetně) a cenu za jeden blok pro jednoho dospělého. Časy vycházejí
  z databázového rozvrhu. Volitelně uložit stejnou cenu pro všechny otevřené
  dny se shodnými bloky, v jedné transakci. Překryv cen se odmítne.
  „Přidat cenový blok“ i „Upravit“ otevřou dialog s dnem, časem od/do a cenou.
  Každý den může mít několik cenových rozsahů. Dialog lze zavřít pomocí Escape,
  křížku nebo zrušení; fokus se vrátí na původní tlačítko.
- Od úpravy z 20. 10. 2026 má cenové období podle začátku návštěvy přednost
  před cenou konkrétního bloku; standardní cena je poslední záloha.
  Po změně otevírací doby se nezarovnané cenové rozsahy viditelně označí a
  přestanou platit, dokud je správce neopraví. Nic se automaticky neposouvá.
- **Přepínač Doprovod a příplatky:** v kartě Doprovod se ukládá ihned,
  odděleně od cen. Výchozí stav je **vypnuto** (i u dosavadního nastavení bez
  přepínače). Klient jej ručně zapne v prosinci; datum automaticky nezapíná funkci.
  Vypnutí skryje volbu lidí v rezervaci, přidání osoby z účtu a počty +1/+2
  v administrativním kalendáři včetně rozpracované změny termínu. Nové příplatky
  i podvržené/staré formuláře odmítne server; nová rezervace stojí základní cenu.
  Připravené ceny zůstávají uložené. Přepnutí zapisuje pouze nastavení a
  administrativní historii, nemění žádnou existující rezervaci či platbu a
  nevolá platební ani mailovou službu. Již zahájené platby zachovávají cenu:
  shodnou rozpracovanou objednávku lze dokončit, dříve založený doplatek se
  nadále ověřuje a potvrzuje právě jednou. Již přijaté doplatky zůstávají v historii.
  Boolean `features.additional_people` je v `site_setting`; další migrace není třeba.
- **Doprovod při zapnutí:** připravená cena je 100 Kč společně za +1 nebo +2 osoby. Správce může
  změnit částku i výpočet na cenu za každou další osobu. Příplatek se počítá
  za každý zakoupený blok. Věrnostní odměna pokryje základní vstup;
  doprovod se hradí i u tohoto vstupu. Voucher se uplatní na cenu objednávky.
- Při zapnutém doprovodu je před rezervací povinná volba sám/sama, +1 nebo +2. Server cenu znovu
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
  Ovládání kalendáře používá společná tlačítka: posun, návrat na dnešek a
  přehledné přepínání týden/den/měsíc. Dnešek má výrazné označení, mřížka
  jemnější čáry a názvy méně tučné písmo. Změna pohledu nemění rezervace.
- **Poznámky členů (#214):** „Přidat poznámku“ / „Upravit poznámku“ přímo v
  seznamu členů a jejich profilu. Vlastní dialog upravuje pouze poznámku,
  nikoliv kontakt nebo předvolby. Smazání textu poznámku odstraní. Existující
  pole `profiles.note` se zachovává, další migrace není potřeba.
  Ikonka StickyNote u jména otevírá Radix tooltip myší, klávesnicí i dotykem.
  Poznámka se načítá podle ID účtu, také v kalendáři, rezervacích, přehledech,
  věrnosti, kódech/vstupech, seznamech dokladů, zpráv a autorů akcí.
  Je pouze v administraci a nevkládá se do zákaznických stránek, e-mailů nebo
  dokladů. Anonymní ani běžný zákaznický účet ji nemůže změnit.
- Apple Design je omezen na administraci: systémové písmo, seskupená navigace,
  rozbalovací další nástroje a jemná okamžitá odezva. Veřejná typografie,
  rozvržení a společné komponenty se nepřestylovávají. FAQ pouze vysvětluje
  nový příplatek; zastaralý přesný výchozí text se již nepoužije.

## Ověření

Ověřeno na Node.js 22.23.3, ve vlastním lokálním Postgresu a s lokálními
náhradami Auth, Comgate a Resend. Testovací server odmítá externí požadavky.
Nebyly použity ostré přihlašovací údaje ani měněny skutečné rezervace.

- Formát, lint, typová kontrola a produkční sestavení: prošly.
- Jednotkové testy: 287 prošlo.
- Integrační testy: 184 prošlo, včetně 20 scénářů nových cen a doprovodu.
- Prohlížečové testy: 119 prošlo po doplnění přepínače doprovodu, včetně přístupnosti, cenového editoru,
  skutečného objednání s doprovodem, doplatku a `+2` v kalendáři.
  Po poslední úpravě mobilního zobrazení zopakovány všechny čtyři scénáře
  `pricing-participants.spec.ts` s novým produkčním sestavením: 4 prošly,
  lokální náhrada mailové služby zaznamenala 0 zpráv.
  Po doplnění poznámek cíleně zopakováno 6 scénářů poznámek/cen/doprovodu:
  všechny prošly, lokální mailová služba zaznamenala 0 zpráv.
  Oba nové scénáře přepínače prošly i samostatně; lokální mailová služba
  zaznamenala 0 zpráv. Ověřeno skrytí formulářů/kalendářních počtů, opětovné
  zapnutí, klávesnice a přístupnost, zachování neuložené ceny, blokování starého
  formuláře a nová rezervace bez příplatku. Integrační testy navíc potvrzují
  dokončení původních plateb bez přecenění a vypnutí bez zápisu do rezervací.
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

Vlastník 14. 10. 2026 schválil merge do `main` a produkční nasazení. Pro tuto pracovní větev
je automatické Vercel nasazení vypnuté. Nastavení produkčních služeb se neměnilo.

Před nasazením kódu byla aplikována migrace
`drizzle/20261014130000_participant_additions.sql` běžným spravovaným postupem.
Je pouze doplňující: nové sloupce s bezpečnými výchozími hodnotami, nová
serverová tabulka a vazba doplatku v platbě. Neobsahuje `UPDATE reservation`
ani nové notifikační triggery. Na produkci byla aplikována 14. 10. 2026 přes Supabase jako
`20261014165450_participant_additions`, po další zkoušce na naplněné lokální
databázi. Nasazení obsahovalo transakční kontrolu otisků všech původních
nastavení, rozvrhu, rezervací, plateb, signálů dostupnosti, e-mailového archivu
a vstupních kódů; případná změna by vrátila celou migraci zpět.
Kontrola prošla. Nebyly spouštěny seed, testovací data, platby ani notifikace.

Produkce si zachovává základní cenu **239 Kč**, rozvrh **5:00–23:45 po 75
minutách** ve všech dnech a původní cenová období. `pricing.time_blocks`
není nastavené: žádné ukázkové cenové rozsahy se nepřenášejí a klient si je
nastaví sám. Doprovod zůstává vypnutý. Nová tabulka doplatků je prázdná;
nová pole historických rezervací mají pouze výchozí nulové hodnoty.
Po migraci zůstalo 285 rezervací, 213 plateb, 687 archivovaných e-mailů a 162
kódů. RLS je zapnuté a tabulka doplatků nemá oprávnění pro anon/authenticated;
info hláška „RLS enabled no policy“ odpovídá záměrně serverovému přístupu.
Průběžný provoz aktualizuje pouze obvyklý stav `nuki-health:*`; nasazení
nepřepisuje obchodní či rezervační nastavení.

Historické rezervace nemají evidenci skutečného doprovodu; nic se u nich
zpětně nedopočítává. Původní rezervace, ceny, kódy a doklady zůstávají zachované.
