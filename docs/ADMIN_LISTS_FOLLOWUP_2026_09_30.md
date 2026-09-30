# Administrace a potvrzený úklid testů – navazující práce 30. 9. 2026

Následující požadavek na ruční faktury ve stejném PR #193 a jeho aktuální výsledky jsou v [reportu ručních faktur](MANUAL_INVOICES_FOLLOWUP_2026_10_01.md). Níže uvedené testové počty zachycují dokončení samotného stránkování a filtrů.

Větev: `codex/final-launch-audit-20260930`. Rozhodnutí a následné důkazy: [#178](https://github.com/lukaskourilcz/gym-plzen/issues/178).

Původní auditní [PR #180](https://github.com/lukaskourilcz/gym-plzen/pull/180) už byl po výslovném schválení sloučen a nasazen. P1 přesunů je opravený v produkci. Původní auditní report zachycuje stav před tímto schválením; aktuální produkční stav, migrace a odložené úkony vlastníka jsou v #178. Toto navazující rozšíření administrace vychází z nového požadavku vlastníka.

Nové rozšíření je v [PR #193](https://github.com/lukaskourilcz/gym-plzen/pull/193), **nesloučené a nenasazené**. **NO-GO pro jeho nasazení:** GitHub Actions se nespustí kvůli billing/spending-limit bloku účtu. Vlastník musí napravit účtování/limit a poté musí projít CI na aktuálním headu. Agent nemění finanční limity, neprovádí platbu a neobchází CI bránu. Původní produkce zůstává funkční a beze změny Nuki konfigurace.

## Úplný rozsah nového stránkování a filtrů

Každá tabulka načítá nejvýše 51 řádků a zobrazuje 50. Filtry se provádějí v SQL před limitem, nikoli jen nad právě zobrazenou stránkou. Řazení obsahuje i ID, takže stejné časové značky nezpůsobí překryv sousedních stránek ve stejné datové sadě. Odkazy uchovávají filtry; nový filtr resetuje stránkování. Formuláře používají GET a lze sdílet jejich URL.

| Stránka                | Hledání / další filtry                                                                                                             | Datum                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Odeslané zprávy        | Jméno zákazníka, e-mail, předmět; kanál, stav, typ. E-maily a ostatní zprávy mají nezávislé stránkování.                           | Odeslání; u dosud neodeslaného záznamu vytvoření |
| Rezervace              | Jméno, e-mail; stav. Přímý odkaz na vybranou rezervaci zůstává funkční.                                                            | Začátek termínu                                  |
| Členové                | Jméno, e-mail, telefon; role                                                                                                       | Registrace                                       |
| Vstupné a věrnost      | Jméno, e-mail, telefon; role. Věrnost se počítá z celé historie viditelných členů.                                                 | Registrace                                       |
| Profil člena           | E-mail / popis; samostatné stránky rezervací, akcí a zpráv. Všechny dotazy zůstávají omezené na vybraného člena.                   | Termín / akce / odeslání podle tabulky           |
| Historie akcí          | Jméno, e-mail, aktér nebo popis; akce                                                                                              | Událost                                          |
| Kniha vstupů           | Jméno, e-mail nebo autorizace; akce a spouštěč                                                                                     | Událost                                          |
| Upozornění             | Titulek nebo popis; závažnost, vyřešeno/nevyřešeno                                                                                 | Vytvoření                                        |
| Doklady                | Jméno, e-mail nebo číslo dokladu; odesláno/neodesláno                                                                              | Vystavení                                        |
| Odběratelé novinek     | Jméno dohledatelného člena, e-mail nebo zdroj; stav                                                                                | Souhlas                                          |
| Vouchery               | Kód; druh slevy a aktuální stav                                                                                                    | Vytvoření                                        |
| Otevírací doba a bloky | Poznámka; důvod. Bez filtrů se zachová chronologický přehled neukončených bloků; hledání a zvolená data zpřístupní i starší bloky. | Překryv zvoleného období                         |
| Vstupní kódy           | Jméno, e-mail; aktuální stav podle skutečné platnosti                                                                              | Překryv platnosti se zvoleným obdobím            |

Celkem **13 stránek / 16 tabulek**. Tabulka vzorových dat v Design systému je statická ukázka. Dashboardy a souhrny pro jeden den zůstávají omezené svým účelem.

## Opravy související s novými přehledy

- Hledání podporuje českou diakritiku i dotazy bez ní. `%`, `_`, zpětné lomítko a SQL syntaxe jsou doslovný vstup; hodnoty jsou parametrizované.
- Datum „do“ zahrnuje celý pražský den. Hranice fungují i při přechodu na letní/zimní čas. Neplatné či obrácené období vrátí prázdný výsledek a zobrazenou chybu.
- Archivní seznam načítá jen metadata, ne HTML, obsah ani PIN. Detail zůstává pod původní autorizací a 30denní retencí. Opakované záznamy jednoho poskytovatele nezdvojují archivovaný e-mail; shodné ID jiného kanálu neschová SMS či WhatsApp.
- Souhrny newsletteru a voucherů se počítají nad celou databází, nezávisle na filtrech a aktuální stránce.
- Vouchery při otevření přehledu neupravují prošlé rezervace čerpání; do čekajících použití se započítají pouze dosud platné rezervace.
- Profil člena počítá počet rezervací a zaplacenou částku z celé historie. Pravidlo posledního stavu platby zůstává stejné; bankovní refund ledger je nadále samostatné rozhodnutí v #178.
- Ukončený blok se neoznačí jako probíhající. Filtr platnosti zachytí i interval, který začal před zvoleným dnem.
- Nezávislé čtení probíhá paralelně; hromadné věrnostní dotazy se spouštějí pouze pro zobrazené členy. Není přidaná klientská knihovna, migrace ani volání poskytovatele pro samotné filtrování.

## Potvrzený úklid testovacích rezervací

Vlastník výslovně potvrdil všech 9 dalších testů. Byly odstraněny přesné schválené řádky: **9 stornovaných rezervací a 9 legacy platebních záznamů**. Z nich žádný nebyl úspěšnou ostrou Comgate platbou. Soukromá záloha, kontrola shody dat před zásahem, transakční guardy a kontrola necílových řádků jsou doložené v komentářích #169 a #178.

Celkový dokončený úklid: **41 testovacích rezervací**. Bezprostředně po posledním zásahu storna klesla **19 → 10**. Při následné kontrole živé DB byl počet **11** a celkem 69 rezervací; přibyl záznam mimo odstraněný seznam. Na vlastnický e-mail a jeho plus-aliasy nebyla navázaná žádná zbývající rezervace. Na 1. října stále připadalo **7 potvrzených termínů**.

Poslední doplnění úklidu nezměnilo ostré příjmy: **49 úspěšných plateb / 11 801 Kč** po původním schváleném odstranění vlastních platebních testů. Celý úklid není refundace ani změna Comgate. Zálohy a citlivé údaje nejsou v Git. Aktuální Nuki oprávnění a 15minutové nastavení zůstaly nedotčené.

## Ověření a omezení

- **271 unit testů**, **145 integračních testů**, bez přeskočení; lokální SQL invarianty prošly.
- **102/102 browser scénářů**, bez přeskočení, v posledním celém lokálním běhu. Zahrnuje aktuální samostatnou mobilní fotografii z `main` (`3e77d9e`) doplněnou do auditní větve.
- Produkční build, typy, lint, formát a kontrola diffu prošly. Plný i produkční npm audit: **0 nálezů**. Vercel preview na aplikačním headu `b059e48` úspěšně sestavené.
- Historie ověřování: starší celá sada 101/102, protože test očekával u člena login namísto následného přesměrování na účet. Po opravě očekávání a lokálního čekání na souhlasový banner prošla nová sada 4/4 a poté celá finální sada 102/102. Neúspěšné meziběhy nejsou označené za úspěšné.
- [PR CI na aplikačním headu](https://github.com/lukaskourilcz/gym-plzen/actions/runs/36780212592) a [push CI](https://github.com/lukaskourilcz/gym-plzen/actions/runs/36780207655) se zastavily před startem runneru: selhaná platba účtu nebo nedostatečný spending limit dle GitHub annotation. API nerozlišuje přesnou příčinu. Žádný CI test v těchto bězích nebyl vykonaný; lokální výsledky se nevydávají za úspěšnou CI bránu.
- Regresní scénáře zahrnují 205 archivovaných e-mailů a 205 doručení, dohledání záznamu za původním limitem, stabilní řazení, jméno hosta i profilu, odpojený archiv, kombinované filtry, skutečné datum odeslání, retenční hranici, doslovné zvláštní znaky, globální souhrny a zachování dat při čtení voucherů.
- Všechny mutační a formulářové testy probíhají na izolované lokální databázi s lokálními náhradami Auth, Resend a Comgate a blokováním externího síťového přístupu. Produkční administrace nebyla používána k mutačnímu testování.
- Tato změna přidává ovládání vyžádaných filtrů a stránkování; nezavádí žádný z dosud neschválených návrhů T1–T11 ani změny FAQ, právních dokumentů, e-mailů či administrační nápovědy.
- U záznamů bez vazby na zákazníka ani odpovídajícího profilu nelze zpětně vymyslet jeho jméno; dostupné zůstává hledání příjemce/předmětu. Archiv a stránka Odeslané zprávy respektují původní 30denní okno; profil člena ponechává starší metadata doručení bez náhledu.
- Offset stránkování může při souběžném příchodu nové události posunout řádky mezi stránkami. Velmi hluboké stránky a hledání podřetězce mohou být dražší; není tvrzena naměřená produkční latence ani zaveden neověřený index.
- Sentry MCP není dostupné; adresáti a doručení alertů nejsou prohlášené za ověřené. Fyzické a právní body vlastníka zůstávají v #178.
