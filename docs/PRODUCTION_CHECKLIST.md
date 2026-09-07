# Produkční review a checklist

Audit: **7. 9. 2026**. Repo `lukaskourilcz/gym-plzen`, výchozí main
`cceaada53bae58131c95205c7ed0f6961873d68e`.

**Verdikt: zatím NO-GO pro ostré objednávky.** Opravy kódu jsou připravené,
ale platnost produkčních klíčů, doručení zpráv, skutečný zámek a responzivní
průchod v prohlížeči nejsou tímto auditem potvrzené.

Audit neměnil produkční data, neposílal zprávy, neprováděl platby a nevytvářel
rezervace na živých službách. Starší tvrzení v dokumentaci nejsou důkazem
aktuálního nastavení poskytovatelů.

## Co bylo opraveno

| Oblast                     | Nález a výsledné chování                                                                                                                                                                                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Obsazení slotů             | Vytvoření rezervace a inicializace doručovací pipeline jsou jedna transakce. Změny blokací/otevíracích hodin a rezervace používají společné databázové zámky. Aktuální délka slotu se znovu kontroluje uvnitř transakce.                                                                                                        |
| Kolize v administraci      | Blokace nesmí tiše zrušit existující rezervaci. Správce musí nejdříve provést storno a vyřešit případné vrácení platby. Bloky začínající před zobrazeným rozsahem se zobrazují, pokud do něj zasahují.                                                                                                                          |
| Časová pásma               | Admin `datetime-local` znamená Europe/Prague, ISO výběry zachovají offset. Validace odmítá neexistující data, jarní přeskočenou hodinu a podvržené sloty se sekundami/milisekundami.                                                                                                                                            |
| Admin kalendář             | Načítá skutečný rozsah zobrazeného měsíce/týdne, používá timezone plugin a pražský čas. Sleduje Realtime změny. Chyba/načítání jsou viditelné a během nich nelze vybírat novou blokaci.                                                                                                                                         |
| Platby                     | Opožděný zápis pending ani událost expirace nepřepíší úspěšnou platbu. Webhook ověřuje vlastníka, částku a měnu. Rozpracovaná duplicitní událost vrací 503 pro opakování; opuštěnou lze znovu převzít. Checkout používá okamžité karetní platby.                                                                                |
| Věrnost                    | Kontrola a přidělení volného vstupu se serializují podle uživatele, aby dva souběžné požadavky nepřidělily stejnou odměnu.                                                                                                                                                                                                      |
| Storno / přesun / doručení | Sdílený obnovitelný zámek brání souběžnému vydání a rušení kódu. Storno odstraní retry pipeline; zrušená nebo skončená rezervace se nedoručuje. Watchdog znovu zkouší neúspěšné odvolání kódu; čekající další krok neobchází backoff ani vyčerpané pokusy.                                                                      |
| Nuki                       | PIN má šest číslic 1–9 a nezačíná 12. Název je stabilní, neosobní a nejvýše 20 znaků. HTTP 204 nestačí: vytvoření se ověřuje přes seznam autorizací včetně časového okna, chyby a probíhající operace. Mazání se ověřuje opětovným načtením. Nejasný výsledek se nepovažuje za úspěch.                                          |
| Potvrzení termínu          | Přesunutá rezervace může dostat nové potvrzení s aktuální ICS přílohou a vyšším SEQUENCE. Nulová cena se označuje „zdarma“, i když pochází z voucheru.                                                                                                                                                                          |
| Formuláře a přístupnost    | Kalendář má vstupní bod pro Tab i v budoucím měsíci a obnoví fokus po PageUp/PageDown. Horizont zobrazuje skutečné poslední datum. Select má alespoň 44px výšku a 16px mobilní text; datumové vstupy se mohou zúžit. Chyby otevíracích hodin a odstranění blokace se zobrazují. Toolbar se skládá podle šířky svého kontejneru. |
| Správci                    | Ochrana posledního správce je transakční a při počítání ignoruje rezervované demo identity.                                                                                                                                                                                                                                     |
| Konfigurace a úklid        | Prázdné volitelné env hodnoty fungují jako nenastavené. Neplatná veřejná konfigurace už tiše neresetuje všechny klíče na localhost. Přidán kontrolní příkaz bez výpisu tajných hodnot. Odstraněny nepoužívané služby/exporty a zastaralé plány. PostCSS aktualizováno bez major upgradu Next.js.                                |

## Ověření živé databáze

Projekt `rkmunagymohxtclymacm` byl dostupný a zdravý. Kontroly byly pouze čtecí.

- [x] RLS zapnuté na všech 26 veřejných tabulkách.
- [x] Veřejný Realtime publikuje pouze `availability_signal`, nikoli osobní data rezervací.
- [x] Existuje exclusion constraint `reservation_no_overlap` pro pending/confirmed.
- [x] Unikátní index Stripe Checkout session a sloupce souhlasů/přesunů existují.
- [x] Tabulky voucherů a dokladů existují; pricing periods mají ochranu proti překryvu a neplatné ceně/rozsahu.
- [x] Otevírací doba všech sedmi dnů 05:00–23:45, slot 75 minut, sprcha 15 minut.
- [x] Standardní cena 289 Kč, horizont 130 dní; říjnové období 199 Kč je uložené od 1. 10. 2026 00:00 do 1. 11. 2026 00:00 Europe/Prague (konec výlučný). Rozhoduje okamžik objednání, nikoli datum návštěvy.
- [x] Existují 3 skutečné správcovské profily. Jejich přihlášení tím není ověřené.
- [ ] Dvě rezervované demo identity odstranit po ověření skutečného správce. Kód je v produkci odmítá.
- [ ] Sladit historii migrací: živé schéma obsahuje 0006–0010, ale Supabase historie je neeviduje. Nepřepisovat interní tabulky bez porovnání schématu a zálohy.
- [ ] Zapnout ochranu proti uniklým heslům; Supabase Security Advisor ji hlásí vypnutou.
- [ ] Potvrdit zamýšlený aktivní časově neomezený voucher; audit jej nedeaktivoval.

Dosavadní data (18 zrušených rezervací, 12 neúspěšných plateb, žádná pipeline ani
zaznamenaná webhook událost) **nedokládají jediný úspěšný kompletní nákup**.

## Klíče a externí propojení

Vercel konektor nevrátil dostupný tým/projekt; produkční hodnoty nebyly získány.
Žádný z následujících klíčů není tímto review označen za platný jen podle názvu.

| Služba                   | Povinná konfigurace                                                | Ověření před spuštěním                                                                                                                                                                                           |
| ------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aplikace                 | `NEXT_PUBLIC_APP_URL`, Node 22                                     | Správná HTTPS doména; odkazy, canonical, callbacky a e-mailová loga používají stejný origin.                                                                                                                     |
| Databáze                 | `DATABASE_URL`, `DIRECT_URL`                                       | Správný projekt; transakční pooler pro aplikaci, migrační připojení odděleně. Obnovitelná záloha.                                                                                                                |
| Supabase Auth / Realtime | `NEXT_PUBLIC_SUPABASE_URL`, publishable nebo anon key              | Shoda projektu s DB, skutečný login/reset/OAuth, žádná tajná hodnota v browser bundlu. Serverové aliasy musí mířit na stejný projekt.                                                                            |
| CMS a média              | `SUPABASE_SECRET_KEY` nebo service-role, `SUPABASE_STORAGE_BUCKET` | Admin upload a následné veřejné zobrazení média.                                                                                                                                                                 |
| Admin Auth šablony       | `SUPABASE_MANAGEMENT_API_TOKEN`                                    | Uložení registrace/resetu v administraci skutečně změní hosted Auth šablonu; staging nesmí měnit produkci.                                                                                                       |
| Stripe                   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                       | Live klíč a live endpoint `/api/webhooks/stripe`; testovací prostředí používá jiný klíč, endpoint i DB. Zpracování podepsané platby a opakovaného webhooku. Hosted Checkout nepotřebuje browser publishable key. |
| Resend / Auth SMTP       | `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, konfigurace SMTP v Supabase | Ověřená doména odesílatele, skutečné doručení potvrzení, PINu a resetu hesla, logo a ICS.                                                                                                                        |
| Nuki                     | `NUKI_API_TOKEN`, `NUKI_SMARTLOCK_ID`, `NUKI_WEBHOOK_SECRET`       | Oprávnění pro správný zámek a autorizace, callback na nové doméně, fyzické otevření/expirace/odvolání.                                                                                                           |
| Cron                     | `CRON_SECRET`, plán ve `vercel.json`                               | Watchdog každých 5 minut a entry log každých 15; běh chráněn secret a podporován tarifem. Ověřit timeout 300 s a heartbeat.                                                                                      |
| Volitelné kanály         | `WHATSAPP_*`, `GOSMS_*`                                            | Skutečný kód používá Meta Graph API; Zernio není implementované. Zapnout pouze ověřený kanál. E-mail je základ.                                                                                                  |
| Volitelné služby         | Maps key + Map ID, GA4, Meta Pixel, Sentry, heartbeat              | Restrikce domén, souhlasy, monitoring a alerty. Prázdné hodnoty nejsou důkazem chyby, pokud službu provozovatel nechce.                                                                                          |

Spustit `npm run check:production-env` v zabezpečeném prostředí se skutečnou
produkční konfigurací. Příkaz nevypisuje hodnoty, nevolá poskytovatele a nic
nemění. Kontroluje přítomnost/tvar/shodu aliasů, **ne platnost a oprávnění klíčů**.

## Technické kontroly této změny

| Kontrola                        | Výsledek                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Unit testy                      | PASS: 106/106                                                                                             |
| Integrační regrese              | PASS: 15/15                                                                                               |
| TypeScript                      | PASS                                                                                                      |
| ESLint                          | PASS, 0 chyb a 0 varování                                                                                 |
| Prettier                        | PASS                                                                                                      |
| Produkční build                 | PASS s vypnutou build telemetrií; sestavení bez produkčních klíčů                                         |
| Kompletní dependency audit      | 4 moderate pouze ve vývojovém řetězci drizzle-kit/esbuild; 0 high/critical. Bez vynuceného major upgradu. |
| Runtime dependency audit        | PASS: 0 zranitelností po aktualizaci PostCSS v Next i Tailwind                                            |
| Env preflight v tomto prostředí | Správně FAIL: produkční klíče zde nejsou; nic nevypisuje tajné hodnoty                                    |
| Skutečný browser / externí E2E  | Neověřeno, zůstává povinnou přejímkou                                                                     |

Integrační testy používají PGlite (Postgres v paměti), skutečné Drizzle dotazy a simulované poskytovatele.
Nevydávají se za test více souběžných připojení do Supabase ani fyzického zámku.

Pro opakování:

```bash
npm ci
npm run format:check
npm run lint -- --max-warnings=0
npm run typecheck
npm test
npm run test:integration
npm audit --omit=dev
NEXT_TELEMETRY_DISABLED=1 npm run build
```

## Akceptační testy před ostrým spuštěním

Každý řádek má být doplněn datem, prostředím, výsledkem a odpovědnou osobou.
Použít izolovanou testovací DB, Stripe test, určenou schránku a testovací zámek.
Ostrou platbu / zprávu provést až jako vědomý provozní test.

- [ ] Dva klienti současně objednají tentýž slot → právě jedna rezervace, druhý dostane srozumitelnou chybu.
- [ ] Současná blokace od správce a zákaznická objednávka → žádná platná rezervace uvnitř blokace.
- [ ] Host i člen: výběr → údaje/souhlasy → Stripe → potvrzení → admin kalendář → PIN na správný čas.
- [ ] Opuštěný checkout po 32 minutách uvolní termín; opožděná zaplacená událost se řeší alertem a refundací, nesmí přepsat cizí rezervaci.
- [ ] Opakované a obráceně doručené webhooky nezmění zaplacenou rezervaci na nezaplacenou ani nevydají dva kódy.
- [ ] Dva souběžné nákupy při nároku na desátý vstup → odměna se použije jednou.
- [ ] Voucher: procenta/částka/limit/expirace/poslední uplatnění ve dvou záložkách, nulová cena a zrušený checkout.
- [ ] Přesun oprávněným členem jednou a alespoň 24 h předem → nový slot a potvrzení, původní PIN přestane fungovat; cizí účet a druhý přesun jsou odmítnuty.
- [ ] Storno zaplacené rezervace → termín volný, kód odvolaný, správce vidí nutnost refundace. Storno samo platbu **nevrací**.
- [ ] Nuki offline / timeout / ztracená odpověď → zákazník nedostane nepotvrzený kód, vznikne retry/alert. Nejasnou autorizaci ručně porovnat v Nuki a DB před dalším vydáním.
- [ ] Watchdog obnoví dočasně selhané doručení a odvolání; operátor obdrží skutečný kritický alert. Alert v DB sám nezaručuje, že ho někdo uvidí.
- [ ] Registrace, potvrzení adresy, reset hesla a Google login v Safari; admin oprávnění skutečně chrání všechny mutace.
- [ ] CMS: text/cena/otevírací doba/blokace/obrázek/šablona se po uložení promítnou do příslušného veřejného toku.
- [ ] Doklad: provozovatel potvrdí údaje a DPH, zapne odesílání a ověří PDF, cenu, číslování a opakované doručení.
- [ ] ICS pro původní i přesunutý termín v Apple/Google kalendáři, CET/CEST a změna času.

## Responzivní a vizuální přejímka

Statický design review potvrdil odstranění konkrétních chyb. Skutečný browser
preview se v tomto prostředí nepodařilo spustit. Žádná šířka proto nemá PASS.

| Šířky             | Co projít                                                                                           | Stav      |
| ----------------- | --------------------------------------------------------------------------------------------------- | --------- |
| 320, 390, 430 px  | Veřejný kalendář, 44px cíle, údaje, voucher, checkout návrat, mobilní navigace, admin den/formuláře | Neověřeno |
| 667, 768, 1024 px | Landscape, tablet, sidebar, toolbar, datumové vstupy a dlouhé texty                                 | Neověřeno |
| 1280, 1440 px     | Týden/měsíc admin kalendáře, tabulky, CMS a veřejné stránky                                         | Neověřeno |

- [ ] Žádný nechtěný horizontální scroll / ořez tlačítek; tabulky mají vlastní scroll.
- [ ] Klávesnice: Tab, šipky, PageUp/Down, viditelný fokus, Escape v menu/dialogu.
- [ ] Zoom 200 %, zmenšený pohyb, čtečka formulářových chyb a kontrast skutečně vykreslených eventů.
- [ ] Vyzkoušet Safari/iOS a Chrome/Android i desktop; nativní datumové vstupy se liší.

## Provozní rozhodnutí a omezení

- Právní texty neměnit bez klientského potvrzení. Převzaté rozpory z HANDOFF:
  kapacita 4/6/5 osob; telefon ve VOP `731 737 557` proti webu `731 737 355`;
  jedna změna termínu proti stornu s refundací. Znění VOP včetně číslování,
  odkazů, překlepů a `údajůdostupných` ponechat přesně dle dodání klientkou.
- Potvrdit společné správce osobních údajů, kamerovou retenci/správce, retenci
  GA4, aktivní poskytovatele a způsob načítání mapy. Audit nedodává právní schválení.
- Změna otevíracích hodin přepočítá budoucí nabídku; existující rezervace sama
  neruší. Před zkrácením provozu vyřešit dotčené rezervace v administraci.
- Při nejasném výsledku Nuki a chybějícím auth ID se systém zastaví bezpečně;
  nelze odhadnout, zda se operace ještě nedokončí. Vyžaduje ruční kontrolu Nuki,
  odstranění případné osiřelé autorizace a opravu souvisejícího záznamu.
- In-memory rate limit je pouze doplňkový; produkční limit objednávek/loginu
  musí být ověřen na sdílené infrastruktuře/WAF. Mapa má nyní omezenou velikost.
- Potvrzovací e-mail a doklad nejsou součástí tvrdé retry garance vstupního
  kódu; po výpadku ověřit jejich doručení v administraci a případně poslat znovu.

## Nasazení a návrat

1. Dokončit technické a browser kontroly na konkrétním PR commitu.
2. Ověřit prod env a provozní checklist; odsouhlasit právní a refundové podmínky.
3. Nasadit během klidného okna a provést určený kompletní nákup.
4. Sledovat Stripe webhook chyby, `system_alert`, pipeline a Nuki autorizace.
5. Při selhání vstupů zastavit nové objednávky provozní blokací volných časů,
   kontaktovat provozovatele a vrátit předchozí Vercel deployment. Před rollbackem
   počkat na doběhnutí nových operací/lease; starý kód jejich zámky nezná.
   Databázové platební záznamy a Nuki kódy ručně sladit, nemažte je hromadně.

Tato změna nepřidává databázovou migraci. Interní operation lease používá oddělený
namespace v existující tabulce `webhook_event`; externí HTTP není uvnitř DB transakce.

## Revize Markdown dokumentace

| Soubor                                     | Rozhodnutí   | Důvod                                                                                     |
| ------------------------------------------ | ------------ | ----------------------------------------------------------------------------------------- |
| `.claude/agents/admin-module-builder.md`   | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/agents/design-system-reviewer.md` | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/agents/integration-builder.md`    | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/commands/add-integration.md`      | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/commands/db-migrate.md`           | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/commands/new-admin-module.md`     | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/rules/design-system.md`           | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/skills/gym-architecture/SKILL.md` | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/skills/markdown-checkup/SKILL.md` | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/skills/session-end/SKILL.md`      | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `.claude/skills/session-start/SKILL.md`    | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `CLAUDE.md`                                | Ponechán     | Aktivní instrukce vývojového workflow, nejde o zastaralý plán.                            |
| `HANDOFF.md`                               | Odstraněn    | Právní omezení přesunuta beze změny významu do checklistu.                                |
| `MANUAL_STEPS.md`                          | Aktualizován | Oddělený staging, aktuální adaptéry a bezpečné postupy bez tvrzení o neověřených klíčích. |
| `NEEDED.md`                                | Aktualizován | Sloučené otevřené úkoly; odstraněná hotová nastavení a duplicity.                         |
| `README.md`                                | Aktualizován | Aktuální stav a odkazy místo historického auditu.                                         |
| `SESSION_HANDOFF.md`                       | Aktualizován | Krátký checkpoint a skutečné blokátory.                                                   |
| `about-project.md`                         | Aktualizován | Doplněný timezone plugin a PGlite.                                                        |
| `docs/CODEX_PHOTO_PROMPT.md`               | Odstraněn    | Jednorázové dokončené zadání.                                                             |
| `docs/DESIGN_SYSTEM.md`                    | Ponechán     | Kanonická pravidla a galerie; opravy nevyžadují nový vzor.                                |
| `docs/FEATURE_IDEAS.md`                    | Odstraněn    | Historická rešerše; obchodní varianty zůstávají v monetization.                           |
| `docs/INSPIRATIONS.md`                     | Odstraněn    | Historická rešerše, není provozním návodem.                                               |
| `docs/MODERN_PLAN.md`                      | Odstraněn    | Implementovaný historický plán; nerozhodnutá varianta zachována v NEEDED.                 |
| `docs/NAVI_REBRAND_PLAN.md`                | Odstraněn    | Implementovaný historický plán; zbývající podklady v NEEDED.                              |
| `docs/PHOTO_PROMPTS.md`                    | Odstraněn    | Jednorázové dokončené zadání; obrázky a jejich označení zůstávají.                        |
| `docs/TOOLING.md`                          | Odstraněn    | Zastaralý výběr nástrojů, skutečný stack je v about-project a package.json.               |
| `docs/UX_AUDIT.md`                         | Odstraněn    | Nahrazen aktuálním auditem, otevřené body převzaty.                                       |
| `monetization.md`                          | Ponechán     | Současný model a budoucí možnosti; předplatné není MVP.                                   |
| `scaling.md`                               | Ponechán     | Výslovně datovaný nákladový odhad, nikoli aktuální cenová nabídka.                        |
| `tests/e2e/README.md`                      | Ponechán     | Platné režimy a ochrana proti zápisu do živých služeb.                                    |
| `docs/PRODUCTION_CHECKLIST.md`             | Nový         | Jediný aktuální produkční audit a přejímka.                                               |
