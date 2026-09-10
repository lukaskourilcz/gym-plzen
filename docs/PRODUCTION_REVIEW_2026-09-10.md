# Profil zákazníka a kontrola před spuštěním — 10. 9. 2026

**Verdikt: profil je implementovaný; aplikace zatím nemá potvrzenou připravenost
na ostrý samoobslužný provoz.** Níže jsou oddělené ověřené změny, nalezená
rizika a kontroly, které ještě vyžadují skutečné služby nebo přihlášení.
Výchozí auditovaná verze `main`: `3cd1eaffe00182c189e2e6d26674bbb94095cd11`.

## Dodané změny

- Účet má karty Moje tréninky, Historie objednávek a Profil a heslo. Historie je
  stránkovaná, obsahuje stav rezervace, poslední platby a odkaz na existující
  vlastní doklad. Probíhající zaplacený slot zůstává v přehledu do konce.
- Profil ukládá samostatné jméno, příjmení, telefon a volbu avataru. Jméno
  a příjmení předvyplňují novou rezervaci; vystavené doklady si zachovávají
  údaje platné při nákupu. Změna telefonu ruší příznak jeho ověření.
- Avatar nabízí dostupnou fotografii z Google identity nebo iniciály.
  Povoleny jsou pouze HTTPS obrázky na Google doméně; při chybě jsou iniciály.
- E-mail je vždy zaškrtnutý a nelze jej vypnout. WhatsApp je volitelný,
  vyžaduje platný telefon a pro nové profily je standardně vypnutý.
  Existující explicitní preference se zachovávají.
- Změna hesla ověřuje současné heslo a identitu v oddělené Supabase session.
  Google účet bez hesla dostává postup přes obnovu hesla. Serverové akce
  odmítají demo a nepřihlášené uživatele; klient nemůže podstrčit cizí ID,
  roli ani vypnutí e-mailu. Doklady se stahují pouze podle vlastníka z Auth.
- Pipeline považuje kód za doručený až po úspěšném odeslání e-mailu.
  Úspěch WhatsApp už neschová chybu e-mailu. Opakování vyřazuje zrušené
  a skončené rezervace. Neúspěšné odebrání v Nuki se neoznačí jako úspěch;
  při rušení rezervace vznikne kritické upozornění správci.
- Aktualizované bezpečnostní opravy `sharp` a `postcss` bez přechodu na
  hlavní verzi Next.js. Vypnutá build telemetrie Sentry; upload sourcemap
  je zakázaný, pokud chybí `SENTRY_AUTH_TOKEN`.
- Domovská stránka ani rezervační průchod již neslibují automatické SMS:
  opravené zdrojové texty i konkrétní česká hodnota CMS `home.about.step3.body`.

## Následné opravy: Comgate a souběh

Stripe SDK, adaptér, webhook a aktivní proměnné jsou odstraněné. Historické
DB sloupce zůstávají pro audit; před migrací bylo všech 12 plateb ve stavu
failed a nebyl žádný vstupní kód. Comgate REST 2.0 je připravené bez klíčů,
platby i fyzický zámek jsou výchozím nastavením vypnuté. Kalendář umožňuje
vybírat budoucí termíny podle svého horizontu. Nezaplacená rezervace se
nepotvrdí; dočasný checkout hold není platný vstup. Dosavadní věrnostní odměny
a plné vouchery zůstávají podporované. Voucherový prodej se zapíná s platbami.

| Původní nález            | Oprava a meze ověření                                                                                                                                                                                                                 |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Souběžné vytváření kódů  | Společný PostgreSQL transakční advisory lock pro fulfillment, vydání, revokaci, storno a přesun. Unikátní živý kód na rezervaci a uložený intent před Nuki požadavkem. Neznámý výsledek blokuje další vytvoření a vyžaduje dohledání. |
| Opakované čerpání odměny | Zamčení řádku zákazníka, výpočet ceny a uložení potvrzené odměny v jediné transakci; unikátní číslo aktivní odměny. Storno odměnu uvolní, storno jiné rezervace ji nevydá podruhé.                                                    |
| Webhook po pádu          | Ledger i obchodní DB změny v jedné transakci; nedokončené starší řádky se zpracují znovu. Watchdog zjišťuje stav Comgate API, pipeline přežije pád po commitnutí platby i při vypnutém zámku.                                         |
| Neznámé založení platby  | Intent před HTTP, zákaz automatického opakování create, unikátní aktivní platba. Bez známého transId upozornění správci; automatické dohledání podle neunikátní reference se nepředstírá.                                             |
| Nuki instalace           | Bez ID autorizace se kód nepovažuje za připravený. Fyzická instalace, odemčení a revokace nadále vyžadují skutečný zámek za měsíc.                                                                                                    |

Migrace `20260910085443_comgate_reliability.sql` byla aplikována v Supabase.
`tests/integration/payment-reliability.sql` prošel nad dočasnými tabulkami
odvozenými z reálného schématu: duplicitní odměna/platba/kód jsou odmítnuty,
storno umožní nové čerpání a rollback webhooku umožní opakování. Žádná
zkušební zákaznická data nezůstala. To není plný souběžný E2E test služeb;
MCP pokusy s advisory lockem neprokázaly překryv dvou spojení.

Callback ověřuje secret, merchant a režim, poté serverové API a vazbu ID,
reference, měny a částky. Návratový odkaz platbu nepotvrzuje. Host používá
náhodný 256bitový token, přihlášený uživatel vlastní Auth identitu.
Produkční Vercel odmítá testovací režim. [Aktivace a provoz](COMGATE_SETUP.md).

## Supabase: ověřený živý stav

Projekt `rkmunagymohxtclymacm` je aktivní a zdravý, region `eu-west-3`.
Migrace `drizzle/20260910071641_customer_profile.sql` byla úspěšně aplikována
jako `customer_profile`: nové sloupce, omezení avataru, výchozí WhatsApp
a indexy historie rezervací/plateb. Následně byly ověřeny skutečné sloupce,
výchozí hodnoty a indexy; zkušební zápis profilu skončil `ROLLBACK`.

- Všech 26 tabulek ve veřejném schématu má RLS. U profilů nemá anonymní role
  SELECT ani přihlášená role přímý UPDATE. Přístup používá ověřené serverové
  služby a Drizzle; informační nálezy „RLS bez policy“ odpovídají architektuře.
- Realtime publikuje pouze `availability_signal`, nikoli zákaznická data.
- Existuje databázové exclusion omezení proti překryvu `pending` a
  `confirmed` rezervací. Odměnu nyní chrání samostatná transakce a unikátní index.
- Security Advisor stále hlásí **vypnutou ochranu proti uniklým heslům**.
  Je potřeba ji zapnout a ověřit registraci i změnu hesla.
- Nastavení `billing.profile` a `billing.send_documents` nebyla uložena;
  automatické doklady proto mají výchozí stav vypnuto. Provozovatel musí
  potvrdit fakturační údaje a zapnout zasílání; zákaznická historie ukáže
  doklad, až skutečně vznikne.
- Existují skuteční správci. Historický úkol založit prvního správce proto
  není důkazem, že správce chybí; předání a odstranění demo identit zbývá potvrdit.
- Historie starších migrací není sjednocená se schématem. Neopravovala se
  naslepo interní migrační tabulka; sjednotit před obnovou nebo stagingem.

## Vercel a externí napojení

V době auditu existoval produkční deployment `READY` navázaný na výchozí
SHA výše a veřejná doména `https://www.navigym.cz` fungovala. Projekt
`prj_NWQTUuVJ3kP6DtY7GXezq0hRrLXv` uvádí Node `24.x`, zatímco repozitář
požaduje Node `>=22.13.0 <23`. V logu předchozího nasazení byl ověřen efektivní Node 22; package engines přebíjí nastavení projektu. Původní deployment běží v `iad1`, databáze v Paříži;
zvážit sladění regionů kvůli latenci (není samo o sobě blokátor spuštění).

Dostupný konektor neumožnil přečíst konfiguraci env projektu. Nebyla proto
potvrzena přítomnost ani správnost produkčních Comgate/Nuki/Resend/WhatsApp
klíčů, webhook secrets, cron secret a Auth redirectů. Žádné tajné hodnoty se
nevypisovaly. Historické úkoly v `NEEDED.md` nejsou náhradou živého ověření.

Před spuštěním dokončit řízený průchod platba → potvrzení rezervace → kód
na zámku → doručený e-mail → skutečné odemčení, a dále storno/revokaci,
opakování webhooku, výpadek e-mailu a volitelný WhatsApp. Ověřit také
registraci, Google přihlášení v Safari, obnovu a změnu hesla, změnu profilu
po znovunačtení a izolaci historie/PDF mezi dvěma účty. Veřejný provozní řád
obsahuje nedoplněné místo lékárničky; finální provozní a právní texty musí
potvrdit provozovatel.

## Provedené kontroly a jejich meze

- Produkční build na Node 22.23.2 dokončený včetně generování stránek,
  optimalizace a route přehledu; nový účet i PDF endpoint jsou dynamické.
- TypeScript a ESLint bez chyb. Celá aktuální unit sada: 119 úspěšných testů.
  Po posledních opravách revokace/pipeline znovu prošla typová kontrola
  a 12 souvisejících testů. Tyto testy nenahrazují distribuované E2E výše.
- `npm audit --omit=dev`: 0 zranitelností po opravách závislostí.
  Audit včetně vývojových nástrojů má 4 středně závažné nálezy;
  nejde o čistý audit všech vývojových závislostí.
- Statické design review účtu provedeno; upravené přístupné popisy avataru,
  stavy ukládání a sdílený vzor v dokumentaci/design gallery.
- Živý veřejný web a kalendář se načetly; výběr dne nabídl sloty s cenou
  a odkazem na údaje rezervace. Nebyla vytvořena ani zaplacena rezervace.
- Browser přístup na lokální server byl blokovaný. Nové přihlášené karty
  a jejich mobilní vzhled proto nemají dokončené vizuální ani mutační E2E
  ověření. Veřejná kontrola starší produkce tuto mezeru nenahrazuje.

Závěr: web je připravený na prezentaci a registrace s vypnutou úhradou.
Placený prodej zapnout po doplnění a ověření Comgate; automatický fyzický vstup
až po připojení a ověření Nuki. Nelze prohlásit za ověřené skutečné služby,
ke kterým nyní nejsou přístupy nebo zařízení.
