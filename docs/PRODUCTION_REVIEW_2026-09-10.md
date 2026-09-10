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

## Zjištěná rizika v kódu před spuštěním

| Priorita | Místo a nález                                                                                                                                      | Dopad a podmínka dokončení                                                                                                                                                                        |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1       | `src/lib/services/fulfillment.ts`: kontrola existujícího kódu a vytvoření nového nejsou chráněné společným zámkem mezi workery.                    | Webhook a watchdog mohou současně vytvořit nebo zrušit různé kódy. Zavést DB claim/lease nebo frontu na rezervaci a ověřit souběh i pád workeru.                                                  |
| P1       | `src/lib/integrations/nuki.ts`: úspěšná HTTP odpověď může vrátit `created: true` bez ID autorizace; asynchronní instalace na zámek není potvrzená. | Nelze spolehlivě doložit instalaci ani pozdější revokaci. Doplnit dohledání/potvrzení autorizace a ověřit vytvoření, časové okno, odemčení, expiraci a revokaci na skutečném zámku.               |
| P1       | `src/lib/services/webhooks.ts`: událost se vloží před zpracováním a všechny existující ID se přeskočí, včetně `processedAt = null`.                | Zachycená chyba claim uvolní, ale tvrdý pád procesu mezi vložením a dokončením může zablokovat všechny další pokusy. Doplnit časově omezený claim, obnovu opuštěných událostí a crash/retry test. |
| P1       | `src/lib/services/loyalty.ts` a rezervační workflow: výpočet nároku na vstup zdarma a vytvoření rezervace nejsou atomické pro jednoho zákazníka.   | Souběžné objednávky různých slotů mohou využít stejný nárok vícekrát. Atomicky rezervovat odměnu a otestovat souběh, storno a neúspěšnou platbu.                                                  |

Tyto nálezy jsou ze čtení kódu, nikoliv tvrzením o již vzniklém incidentu.
Jednotlivé bezpečnostní opravy výše neřeší celou distribuovanou pipeline.

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
  `confirmed` rezervací. To však neřeší souběh nároku na odměnu.
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
požaduje Node `>=22.13.0 <23`. Sjednotit nastavení a ověřit efektivní runtime
v logu nasazení. Původní deployment běží v `iad1`, databáze v Paříži;
zvážit sladění regionů kvůli latenci (není samo o sobě blokátor spuštění).

Dostupný konektor neumožnil přečíst konfiguraci env projektu. Nebyla proto
potvrzena přítomnost ani správnost produkčních Stripe/Nuki/Resend/WhatsApp
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
- TypeScript a ESLint bez chyb. Celá unit sada: 108 úspěšných testů.
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

Závěr auditu je **nespouštět placený bezobslužný provoz**, dokud nejsou
uzavřené P1 nálezy a doložený průchod skutečnými službami.
