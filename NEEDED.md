# Co zbývá dokončit

Aktualizováno **1. 10. 2026**. Tento soubor obsahuje pouze otevřené kroky a rozhodnutí. Auditní rozhodnutí a důkazy jsou v [#178](https://github.com/lukaskourilcz/gym-plzen/issues/178); očištění veřejného repozitáře má samostatnou [#195](https://github.com/lukaskourilcz/gym-plzen/issues/195).

## 1. Rozhodnutí a podklady vlastníka

- [ ] **R1 — Jak evidovat skutečné refundace?** Zvolit zdroj v Comgate (ledger/API), nebo doložený ruční záznam částky, data, platebního ID a dokladu; zahrnout plné i částečné vratky. Doložit případné nevyřízené zákaznické vratky přímo u poskytovatele. Rozhodnutí [#147](https://github.com/lukaskourilcz/gym-plzen/issues/147) je soustředěné v #178. Storno ani „Vyřešeno“ u upozornění nepotvrzuje vrácení peněz; Finance zatím nejsou čistý bankovní výpis.
- [ ] **R2 — Zapnout ochranu proti uniklým heslům v Supabase Auth?** Poslední audit doložil vypnuté nastavení. Vlastník potvrdí jeho zapnutí, případně vědomé ponechání vypnutého stavu. Po změně ověřit registraci, reset a změnu hesla.
- [ ] **R3 — Které voucherové definice mají dál zůstat aktivní?** Ověřit dnešní aktivitu, platnost a limity voucherových definic; vlastník určí případné deaktivace testovacích či neomezených slev.
- [ ] **R4 — Komu a při kterých událostech posílat provozní upozornění?** Potvrdit příjemce a volby pro novou rezervaci, změnu termínu, storno, registraci a provozní problém. Při provozním ověření zkontrolovat skutečné doručení, včetně schránky `info@navigym.cz`.
- [ ] **R5 — Ponechat, nebo vypnout Meta Conversions API Gateway?** Nejprve doložit vlastníka a účel gateway v nastavení datasetu. Povolení dalších hostů v CSP vyžaduje rozhodnutí; současná CSP se kvůli staré konzolové hlášce automaticky nerozšiřuje.
- [ ] **Očištění veřejného repozitáře — #195:** zkontrolovat a vyřešit osobní/provozní údaje v aktuálních souborech, historii, issues, PR a Actions logách; zkontrolovat demo tajemství, ignorování `.env` variant a secret scanning/push protection. Podrobnosti v [#195](https://github.com/lukaskourilcz/gym-plzen/issues/195). Samotná veřejná viditelnost toto očištění nedokládá.
- [ ] **Podklad: zdrojové logo ve vektoru.** Dodat SVG/PDF znaku, wordmarku a společného loga pro nahrazení současných rastrových podkladů.

## 2. Ověření dohledu a externích služeb

- [ ] **Sentry:** připojit přislíbený MCP s oprávněním ke čtení. Ověřit produkční události, zapojení serverového i prohlížečového sběru, pravidla alertů, příjemce a skutečné doručení upozornění. Doložit přístup ke čtení a výsledky ověření.
- [ ] **Hosting:** doložit skutečné edge/WAF limity pro přihlášení a checkout a ověřit sdílenou ochranu mezi instancemi. Procesový rate limit ji nezajišťuje. Posoudit využití Auth connection poolu podle měření; samotný advisor INFO není důvod automaticky měnit pool.
- [ ] **Search Console:** ověřit dokončení zbývajícího oznámení přesunu `namastegym.cz` bez `www` na `navigym.cz`. Poslední doložené potvrzení tohoto konkrétního přesunu chybí; stará chyba validace se nepovažuje za nově ověřenou závadu.
- [ ] **GA4 a Meta:** zpřístupnit správnou GA4 službu `G-8FN17RXP1T`, ověřit atribuci UTM a událost nákupu po souhlasu. V Meta doložit ověření domény a příjem událostí u správného datasetu. Před publikováním reklamy dodat konečnou kreativu, příjemce a plátce reklamy. Skutečnou platbu či publikování provádí vlastník.

## 3. Fyzické a provozní ověření vlastníkem

Tyto kroky vlastník odložil. Agent je nenahrazuje produkčními rezervacemi, zprávami, platbami ani akcemi na Nuki. **Současná platnost PINů do konce slotu +15 minut zůstává podle posledního pokynu beze změny.** Výhradní užívání celého prostoru zaplacenou skupinou zůstává požadovaným pravidlem; souběžné užívání další skupinou nebylo schválené.

- [ ] **Fyzický provoz:** určit přesné umístění lékárničky (T11), skutečné kamerové zóny a značení (T5), ověřit únikové cesty a deklarované vybavení. Doložit postup odchodu a sprchy slučitelný s výhradním užíváním slotu (T2–T4).
- [ ] **Celá cesta rezervace a vstupu:** na vlastním účtu ověřit skutečnou platbu a částku v Comgate, potvrzení, PIN do inboxu nejdříve T−60 minut a volitelný WhatsApp při souhlasu zákazníka. Ověřit i placenou objednávku více termínů: jedna platba, všechny termíny potvrzené a PIN pro každý termín. Na klávesnici vyzkoušet odmítnutí před začátkem, vstup během platnosti, odmítnutí po konci +15 minut a odebrání při stornu/přesunu; ověřit záznam vstupu a chování při výpadku Wi-Fi. Případnou refundaci provede pouze vlastník.
- [ ] **Hosted Auth a skutečná zařízení:** registrace/potvrzení, reset včetně expirovaného a opakovaného odkazu, nové heslo, odhlášení a Google přihlášení na ostré doméně, zejména Safari/iPhone. Ověřit SMTP, povolené callback URL a Google consent. U hosted šablon ověřit skutečně doručený obsah; nepřepisovat je automaticky starým návodem.
- [ ] **E-maily, kalendář a ruční faktura:** ověřit zobrazení v Gmailu, Outlooku a iPhonu; import `.ics` do Google i Apple kalendáře se správným letním/zimním časem. Po vydání PR #193 vlastník ověří doklad ke skutečně zaplacené rezervaci, údaje/částku/číslování, zvolené příjemce a záznam v Odeslaných e-mailech. Přijetí Resendem není důkaz doručení do inboxu. Doklady se vystavují pouze ručně, jeden na společnou objednávku; u vstupů zdarma se nevystavují.

## 4. Texty ke schválení nebo doplnění

**Následující návrhy nejsou schválené ani publikované.** Úplné důkazy nesouladů a původní návrhy jsou v [#178](https://github.com/lukaskourilcz/gym-plzen/issues/178), převzaté z [#175](https://github.com/lukaskourilcz/gym-plzen/issues/175). Schválení provozního chování nebo archivu neznamená schválení jeho textové formulace.

| ID                                        | Co má vlastník schválit nebo doplnit                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **T1 — Soukromí §4**                      | Nahradit tvrzení o nemožnosti obnovit celý PIN popisem šifrované kopie a obsahu e-mailů. Návrh níže.                                                                                                               |
| **T2 — Homepage, platnost PINu**          | Opravit tvrzení „pouze během rezervovaného časového okna“ podle skutečné platnosti +15 minut. Konečné znění musí být sladěné s pravidlem odchodu T3.                                                               |
| **T3 — VOP 5.3/5.4 a provozní řád 2.5**   | Dodat jednotné pravidlo odchodu a sprchy při zachování výhradního užívání celého prostoru zaplacenou skupinou. Starý návrh povolující překryv skupin není schválený; současné nastavení PINů se nemění.            |
| **T4 — FAQ 6, výhradní užívání**          | Sladit vysvětlení výhradního užívání s T2/T3. Platnost PINu předchozí skupiny +15 minut sama o sobě není povolením sdílet prostor během dalšího slotu.                                                             |
| **T5 — FAQ 14, kamery**                   | Po fyzickém potvrzení zón a značení schválit: „Vybrané části studia jsou monitorovány kamerovým systémem. WC a sprcha monitorovány nejsou.“                                                                        |
| **T6 — Akční cena**                       | Opravit uložený CMS fallback: „Akční cena platí pro návštěvy v uvedeném období. Cenu každého termínu uvidíte v kalendáři před platbou.“ Rozhoduje datum návštěvy; aktuální aktivní promo tento fallback přepisuje. |
| **T7 — FAQ 7, rozsah ceny**               | Schválit: „Cena závisí na datu návštěvy. Aktuální cenu každého 75minutového termínu uvidíte v kalendáři; platí pro celou skupinu až 5 osob.“ Případně dodat samostatné znění říjnové akce.                         |
| **T8 — Soukromí §6, poskytovatelé zpráv** | Doložit skutečný seznam poskytovatelů a smluvní vztahy. Návrh: „Poskytovatelům e-mailů a WhatsApp zpráv (Resend, Zernio a Meta); poskytovateli SMS pouze při aktivaci tohoto kanálu.“                              |
| **T9 — Neaktivní CMS `rules.body`**       | Samostatně schválit archivaci/odstranění starého nepoužívaného klíče s kapacitou 6 osob a vracením kreditu.                                                                                                        |
| **T10 — Admin nápověda ke změně termínu** | Popsat držení obou intervalů a ověření nového PINu před potvrzením přesunu v T−24 hodin. Návrh níže.                                                                                                               |
| **T11 — Provozní řád 5.4, lékárnička**    | Dodat přesné fyzické místo pro větu „Lékárnička první pomoci je umístěna: …“. Nezveřejňovat placeholder.                                                                                                           |
| **T12 — Nastavení, Doklady a nápověda**   | Schválit odstranění zastaralých nabídek automatického vystavování a texty o ručním vytváření dokladů. Konkrétní návrhy níže.                                                                                       |

### Přesná znění delších návrhů

**T1 — Soukromí §4:**

> Pro bezpečné doručení a opakování při výpadku ukládáme kromě hashe a posledních dvou číslic také šifrovanou podobu PINu. Šifrovací klíč je uložen odděleně od databáze. Po potvrzeném odebrání nebo expiraci odstraníme šifrovaný PIN z přístupového záznamu. Obsah odeslaných e-mailů, který může obsahovat PIN, uchováváme pro oprávněnou administraci po dobu 30 dní.

**T10 — Admin nápověda:**

> Nejprve se drží původní i nový termín. Staré oprávnění se odebere, pokud existuje. Je-li zapnutá příprava kódů a nový termín je během příštích 24 hodin, musí být nový PIN ověřen před potvrzením změny. Při nejasném výsledku zůstane původní rezervace zachována a oba termíny mohou být dočasně blokované do ověřeného úklidu.

**T12 — Nastavení:** odstranit zastaralý automatický přepínač a použít:

> Doklad o zaplacení vytvoříte ručně u zaplacené rezervace tlačítkem Vytvořit a poslat fakturu. Příjemcem může být zákazník, info@navigym.cz nebo obě adresy. Potvrzení rezervace se posílá samostatně. Ke vstupu zdarma se doklad o zaplacení nevystavuje.

**T12 — Doklady:** odstranit kartu nabízející zapnutí automatického odesílání. Prázdný stav:

> Zatím žádný doklad. Vytvoříte ho ručně u zaplacené rezervace v přehledu Rezervace.

Popisek stránky:

> Doklady o zaplacení vystavené k zaplaceným rezervacím. Každá objednávka dostane nejvýše jeden doklad; u více termínů je společný.

**T12 — Jak co funguje? / Platba a potvrzení:**

> Doklad o zaplacení se vystavuje pouze ručně u zaplacené rezervace tlačítkem Vytvořit a poslat fakturu. Lze ho poslat zákazníkovi, na info@navigym.cz nebo na obě adresy; odeslané e-maily se evidují v administraci. U společné objednávky více termínů je jeden společný doklad.

### Další textové podklady

- [ ] **Finální právní znění a účinnost:** potvrdit VOP, provozní řád a soukromí, zejména více termínů v jedné objednávce (VOP 4.6), změnu/storno jednotlivého termínu (8.9), vratku při důvodu na straně provozovatele (8.8) a zákaznické storno bez vrácení platby (8.10). Rozhodnout o datu účinnosti; v kódu je nyní 17. 8. 2026. Konečná formulace musí odpovídat zvolenému refund modelu R1.
- [ ] **Název kosmetiky:** dodat značku české přírodní kosmetiky, má-li být uvedena, nebo potvrdit současné obecné označení jako konečné. Název nebyl dodán.

## 5. Zbývající konkrétní technické drobnosti

- [ ] **Zaškrtávátka administrace:** zbývající `CheckboxField` v profilu člena a nastavení má stále malý řádek bez minimálního 44px cíle. Sjednotit se sdíleným přístupným ovládáním a ověřit klávesnici/focus; zachovat texty.
- [ ] **Barvy PDF:** v `src/lib/pdf/invoice-pdf.ts` zůstává `MUTED` `#5a6b64` a `RULE` `#c9d3ce`, odlišné od palety `#5b6360` / `#dcd7cc`. Sjednotit a vizuálně ověřit PDF bez změny jeho textu či údajů.
- [ ] **Nativní 200% zoom kalendářů:** doplnit skutečný browser zoom veřejného i admin kalendáře. Ověřit čitelnost, ovládání a přetečení při skutečném browser zoomu.
