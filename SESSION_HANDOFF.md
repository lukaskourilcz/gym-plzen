# Rozhodnutí vlastníka po auditu — 29. 9. 2026

PR #98 (nasazeno). Smazány produkční demo účty `admin@namaste.demo` a
`klient@namaste.demo` (jen staré zrušené rezervace). Zákaznické storno v Můj účet
(`reservations.cancelByCustomer`: termín se uvolní, PIN se odebere, platba se
nevrací, bez refund alertu a storno e-mailu, záznam v historii akcí). VOP: telefon
+420 732 817 217, 5 osob, 8.4 cena se změnou termínu nemění, 8.10 storno, ČOI bez
utm. Provozní řád 2.3/2.4/7.4 a FAQ 11/12 upraveny v kódu i v produkčním CMS
(`content_block`). FAQ 3 vrácena na přání vlastníka s jeho zněním („videorádce (chystáme)“), v kódu i v CMS. Newsletter:
podepsaný odkaz `/newsletter/odhlaseni` + admin „Odhlásit“, oba logované.
Leaked password protection agent zapnout nemůže (NEEDED). Kontakty webu (731…/721…)
beze změny – čeká na potvrzení. 239 unit, 94 integračních; produkce ověřena.

---

# Audit před otevřením — 29. 9. 2026 (noc)

Šest paralelních read-only review (rezervace, platby, přístupové kódy, administrace a
bezpečnost, účet a web, testy) + read-only kontrola produkce (Supabase, Vercel logy).
Opravy v PR #93–#97 (sloučeno a nasazeno). Produkční data zákazníků se neměnila,
nikomu se nic neposlalo; jediný zápis agenta na produkci v této session jsou migrace
z předchozí části (objednávky).

**Nejdůležitější opravy.** Odebraný termín se dál účtoval (formulář držel první výběr);
middleware čekal na Supabase Auth bez limitu (61× 504 za 48 h); pozdní platba nikoho
neupozornila; e-mail sám mohl zrušit cizí rozpracovanou objednávku a otevřená platba
šla nahradit (dvojí platba); PIN se ztraceným odesláním do Nuki se nikdy neopakoval
(#85 – na produkci po nasazení uzavřen); skončené kódy zůstávaly v zámku; stránky
administrace hlídal jen layout; otevřené přesměrování po přihlášení; chyby Postgresu z
drizzle 0.45 se nerozpoznávaly; #84 probíhající blok; uzávěra/storno v administraci bez
potvrzení; testy mohly sáhnout na vzdálenou DB a posílat e-maily (síťová pojistka).

**Ověření.** 237 unit, 91 integračních (nové: objednávky, přístupové kódy, watchdog,
změna termínu, webhook/cron autorizace, administrace), SQL test, typecheck, lint,
formát, Vercel buildy. Produkce po nasazení: kalendář, údaje, přesměrování před
otevřením, #85 uzavřen, PIN budoucí zákaznice (1. 10. 16:15) nedotčen, watchdog běží.
UI nových potvrzení administrace neověřeno v prohlížeči (vyžaduje admin přihlášení).
Vynecháno: omezení `/reset-password` (vráceno, k rozhodnutí).

**K rozhodnutí vlastníka**: sekce „Audit před otevřením“ v NEEDED.md, nejdřív
produkční admin `admin@namaste.demo`.

---

# Objednávky více termínů hotové — 29. 9. 2026

Epic #76 dokončen, všech 7 kroků sloučeno a nasazeno: #87 model, #88 služby a
platba, #89 doklad/potvrzení/upozornění za objednávku (+ migrace
`invoice.items`), #90 veřejné UI, #91 účet a administrace, #92 texty. Obě
migrace (`booking_orders`, `invoice_items`) jsou na produkci.

**Jak to funguje.** Kalendář: termín je přepínač (`aria-pressed`), výběr až 10
termínů v URL (`start=` opakovaně), lepicí lišta → `/rezervace/udaje` se
seznamem, voucher na celou objednávku → `orders.startOrder` (jedna
`booking_order`, rezervace per termín, věrnost přes termíny, sleva rozpočítaná)
→ `payments.startOrderPayment` → webhook potvrdí vše nebo nic. Fulfillment:
potvrzení, upozornění a doklad jednou za objednávku (`announceConfirmed`, listový
zámek `order-fulfillment:<id>`); PIN, změna a storno per termín. Cookie
`navi_hold` = `o.<orderId>.<token>`. Starý `booking.startBooking` a
`reservation_id` na hotovo zůstávají pro dřívější holdy a odkazy.

**Ověřeno.** 223 unit, 57 integračních (13 v `tests/integration/orders.test.ts`),
build, lint, typy, formát. Lokální produkční build proti lokální DB: 3 termíny
ve 2 dnech → 100% voucher → 3 potvrzené, `.ics` se 3 událostmi. Playwright
320–1728 px bez přetečení, klávesnice, fokus. Design review bez P0, P1/P2
opraveny. E2E `booking-flow` + `public` 18/19 (selhání „Pokračovat přes…“ je
lokální `NEXT_PUBLIC_OAUTH_PROVIDERS`). Produkce: kalendář s přepínači,
`/rezervace/udaje` se 2 termíny ukazuje „Pokračovat k platbě 398 Kč“.

**Neověřeno / pro vlastníka.** Skutečná placená objednávka přes Comgate;
znění VOP 4.6 a 8.9 a datum účinnosti (NEEDED). Lokálně chybí Node 22
(`npx -p node@22`) a Comgate; testovací DB `codex_navi_access_test`.
Otevřené chyby #84–#86 z 28. 9. zůstávají.

---

# Objednávky 1/7: datový model — 28. 9. 2026 večer

Krok #77 hotový (PR #87). Nová tabulka `booking_order` (+ enum
`booking_order_status`), nullable `order_id` na `reservation` (SET NULL),
`payment` (SET NULL), `invoice` (RESTRICT), `voucher_redemption` (CASCADE);
unikátní `payment_active_order_uidx`, `invoice_order_uidx`,
`voucher_redemption_order_uidx`. `invoice.reservation_id` a
`voucher_redemption.reservation_id` zůstávají NOT NULL — doklad/claim
objednávky ukáže na první termín (rozhodnout v #78/#79). Migrace
`drizzle/20260928220000_booking_orders.sql` aplikována na produkci před
sloučením (Drizzle `select()` vyjmenovává nové sloupce). Lokální testovací DB
`codex_navi_access_test` je migrovaná: `TEST_DATABASE_URL=postgres://$USER@localhost:5432/codex_navi_access_test`.
Node 22 lokálně chybí, použit `npx -p node@22`. 208 unit, 44 integračních,
SQL test indexů, typy, lint, build prošly; `npm audit --omit=dev` 0 (4 moderate
esbuild jen v dev). Další krok: #78 služby objednávky.

---

# Test kliky, objednávka více termínů — 28. 9. 2026

Kontext z WhatsAppu a dvou hlasovek: provozovatelky chtějí kupovat více
termínů najednou; Renča 28. 9. dopoledne kliku přeinstalovala (jiný typ
otevírání) a kalibrovala, Wi‑Fi v gymu dál vypadává; 29. 9. tam budou od 13:00,
obě ve 14:00.

**Klika po kalibraci.** Nuki dohled v `site_setting` `nuki-health:22819692303`
hlásí `online` (21:40). Kniha vstupů (sync z Nuki logu) ukazuje 28. 9.: dvě
kalibrace (`action_253`, Renča, 09:53 a 10:01), poté klávesnicové `unlatch`
kódem `999999` v 10:05, 10:05, 10:06 a 17:20 s následným `auto_lock`/ručním
zamknutím. Klávesnice tedy po kalibraci otevírá. Přímé čtení Nuki API nešlo:
lokální `NUKI_API_TOKEN` patří účtu bez zámků, produkční token je jen ve
Vercelu (přístup zamítnut). Kódy jsou v produkci zapnuté od 20. 9.
(`booking.operations.accessCodesEnabled=true`). Výpadek Wi‑Fi: příprava PINu
běží −24 h, `recoverAccessCode` při `device_offline` jen opakuje; už potvrzený
PIN (`provision_state=ready`) se doručí i při výpadku; nový PIN se bez zámku
nepotvrdí a e‑mail nejde, dokud se zámek nepřipojí (alert po 5 pokusech).

**Profil pro testy.** Telefon účtu `kouril.lukas@gmail.com` změněn přes Můj
účet → Profil na `+3546117942` (DB ověřeno). Zkušební WhatsApp se ale řídí env
`ZERNIO_TEST_RECIPIENT`/`ZERNIO_TEST_EMAIL` (`isZernioTestRecipient`), takže
bez změny env + redeploy přijde jen e‑mail → NEEDED.

**Zkušební rezervace 29. 9. 13:45–15:00 nezaložena.** Administrace odmítla:
„Tento termín je blokovaný“ — blok `private_event` 20. 9. 13:45 → 1. 10. 00:00
(`72444827…`), který stránka bloků nezobrazuje, protože filtruje jen bloky
začínající v rozsahu (issue #84). Úprava bloků byla agentovi zamítnuta
(sdílený zdroj); přesný postup pro vlastníka v NEEDED.md. Žádná změna bloků,
rezervací ani env neproběhla; jediná produkční změna je telefon v profilu.

**Nálezy.** Záměr kódu `bf2adc93…` (rezervace `2d1cbc47…`, 22. 9., stornovaná)
se odebírá donekonečna: `submitted` bez `nuki_auth_id`, prošlá platnost,
87 pokusů, dva otevřené alerty (issue #85). Testovací příjemce WhatsApp jen v
env (issue #86). Otevřené alerty `refund-needed` pro `8e056780…` a `987fdf8b…`
(refundace v Comgate ručně) zůstávají.

**Objednávka více termínů.** Plán a rozhodnutí:
[docs/MULTI_SLOT_ORDER_PLAN_2026_09_28.md](docs/MULTI_SLOT_ORDER_PLAN_2026_09_28.md).
Epic #76, kroky #77–#83 (model → služby → platba → UI → e‑maily → účet/admin →
texty). Kód se v této session neměnil; repo bylo o 190 commitů pozadu a je
sjednocené s `origin/main`.

---

# Kompaktní admin kalendář — 25. 9. 2026

Nasazeno PR #74, commit 1d251d8, deployment dpl_A4SVvJArSCLX7L4Tu51z8QwXm52f READY.
Živý týden 28. 9.–4. 10.: všechny 3 šedé bloky bez textu, 7 rezervací bez
oříznutí a s nulovou odchylkou od svého řádku. Na aktuální široké obrazovce
všech 15 řádků 44px. Produkční build prošel; sloučená větev odstraněna.

Navazující oprava podle screenshotu uživatele: všechny background/inverse-background
bloky bez viditelného textu, zůstává stínování. Výchozí řádek 44px, pouze řádky
s delšími jmény se zvětšují. ResizeObserver sleduje jména a kontejner, MutationObserver
změny zobrazených událostí; odpojená jména se uvolňují. Font ready také přeměří.
Scoped CSS mimo FullCalendar DOM přežije jeho redraw. expandRows vypnuto.
Samotné updateSize/render nestačí na přepočet slat cache; čerstvý objekt stejného
slotDuration ji obnoví při skutečné změně výšek, bez změny pohledu/data.

Chrome: při 667px řádky 9/10 měří 65/82px, všechny ostatní 44; události 64/81px,
odchylka od začátku řádku 0 a žádné oříznutí. Při 1440px 44/47px, události 43/46px,
opět offset 0. Prázdný týden všech 15 řádků 44px. Background text prázdný.
Základní responzivní kontrola 320–1728px bez horizontálního přetečení;
klávesnice/focus beze změny. 208 testů, lint, typy, formát, audit 0 prošly.
V konzoli lokálně chyba rozšíření React DevTools (chrome-extension), ne aplikace.

---

# Admin kalendář a přesné SEO texty — 25. 9. 2026

Nasazeno: PR #73, commit c4a3a89, deployment dpl_22Qcq46RFdRtb3A9FNT5X6dFmqee
READY. Živý Chrome v týdnu 28. 9.–4. 10.: 15 správných intervalů, 7 rezervací,
0 duplicitních časů, 0 oříznutých jmen, bez přetečení. HTTP produkce potvrzuje
přesný nový titulek i description. Sloučená větev smazána lokálně i vzdáleně.

Kalendář nově používá nakonfigurovanou délku rezervací místo hodinových řádků.
Při současných 75 minutách má 15 řádků, popisky 05:00–06:15 až 22:30–23:45;
v událostech pouze jméno, bez času a e-mailového fallbacku. Vyšší 80px řádky,
zalamování jmen, sémantické barvy, viditelný focus. Snap bloků sleduje řádky.
Smíšené délky/otevírací časy používají společnou mřížku nejméně 15 minut;
rezervace zachovávají skutečnou časovou polohu. Read-only příklad v design kitu.

Na navazující přesný pokyn uživatele titulek homepage:
NAVI Private Gym | Soukromé fitness Plzeň
Popisek: NAVI Private Gym: celé samoobslužné fitness v Plzni jen pro vás a váš
doprovod. Rezervujte si svůj trénink v soukromí online.

208 testů, lint, typecheck, formát, audit bez zranitelností a produkční build
prošly. Chrome lokálně: 320, 390, 667 landscape, 768, 1024, 1280, 1440, 1728 px;
při 667 nalezené oříznutí delšího jména opraveno výškou 80px a ověřeno. Den,
týden i měsíc bez duplicitního času; klávesnice/focus ověřeny. Reflow při
poloviční šířce 735px bez přetečení; skutečný 200% browser zoom se klávesovou
zkratkou neaktivoval, nelze vydávat za provedený test. V kalendáři nebyly
nalezeny aktivní animace; samostatná emulace reduced motion neprovedena.
Design-system reviewer po opravě minimálního intervalu bez P0–P2.

---

# SEO a migrace — 25. 9. 2026

Čtyři body implementované a živě ověřené, s jedním externím nedokončeným
krokem GSC. Staré čtyři hosty přesměrovávají na www.navigym.cz (holá
namastegym.cz 301, ostatní 308), cesty i query zachovány. Sitemap Success / 9 URL.
Homepage „URL is on Google“, nová indexace vyžádána. Všechny čtyři staré
URL-prefix služby ověřeny přes dvě HTML značky, bez Websupport/DNS přístupu.
Change of Address přijat pro www.namastegym.cz a obě namastegymplzen.cz;
namastegym.cz bez www stále vrací Google „Couldn’t fetch the page“ po třech
pokusech, přestože HTTP 301→200 a vlastnictví fungují. Později zopakovat.

GBP přijal datum 1. 10. 2026, HTTPS web s UTM a rozšířený popis (veřejně ověřen).
Rezervační odkaz s UTM a popis služby uloženy. Reálné fotky a dobrovolné recenze
od návštěvníků zbývají provozovatelům; zprávy zákazníkům neposílány.
Web má nový místní titulek/popisek a HealthClub JSON-LD s aktuálními kontakty.
PR #71 a #72 sloučené, větve smazané. Produkční commit c835c9f, deployment
dpl_Csjz9f6YH4VfKaBgV2dmTYNg14un READY, obě Google značky živě ověřené.
GOOGLE_SITE_VERIFICATION obsahuje dvě čárkou oddělené značky, nesmazat.
205 unit testů, lint, typy, formát, audit (0) a build s izolovanou lokální DB
prošly. Detail a konkrétní zbývající kroky: docs/SEO_MIGRATION_2026_09_25.md.

Ranní úklid testů: 11 zbývajících potvrzených rezervací vlastníka stornováno,
všech 26 pod jeho e-mailem cancelled. Tři odebrání kódů ještě čekala na Nuki,
budoucí slot 2. 10. 05:00 správně blokovaný. Historie zachována, bez refundace.

---

# Živá věrnost — 24. 9. 2026 večer

Uživatel místo úklidu výslovně požádal o další rezervace a schválil podmínky všech čtyř. Vlastní testy 1. 10. 11:15, 12:30, 13:45 s voucherem posunuly počítadlo na 7, 8, 9. Desátá 1. 10. 15:00–16:15 nabídla vstup zdarma bez pole voucheru a byla potvrzena: „Tohle byla vaše 10. návštěva a byla zdarma.“ Následující formulář opět ukázal 199 Kč (neodeslán). Současná věrnost tedy počítá potvrzené budoucí termíny i 100% voucher, nikoli jen zaplacené nebo absolvované vstupy. Žádné storno provedeno. Kódy zůstávají plánované -24 h / doručení -1 h.

Kalendář PR #70 je na produkci READY, commit c92e1b3, živé listování ověřeno. Zernio ruční test 22:06 stále jen Sent; uživatel dosud nepotvrdil doručení. Dotaz na příchozí TEST čeká na odpověď. Podrobnosti v auditu z 24. 9.

---

# Plynulé listování a WhatsApp test — 24. 9. 2026

Na výslovné nové přání uživatele kalendář po prvním posunu přednačítá čtyři dny dopředu. První render zůstává pouze čtyřdenní. Paměť drží první čtyři + okolí vybraného dne -2/+4 (max. 11); požadavky potřebné při dalším kliknutí se nepřerušují. Vzdálené požadavky se ruší, opožděné odpovědi ignorují. Limit 180 dní nezměněn.

205 unit a 44 integračních testů prošlo, typy/lint/build/audit bez chyby. Chrome ověřil listování přes první čtyři dny, klávesnici/focus a šířky 320–1728 px bez horizontálního přetečení. Plné ověření 200% zoomu a reduced motion zůstává otevřené. Design review bez P0–P2, opraven popis v administraci.

Živá rezervace vlastníka 1. 10. 2026 10:00–11:15 za 0 Kč potvrzena s výslovným souhlasem s podmínkami; voucher NAVI-WA-TEST-2210. Standardní příprava -24 h a odeslání -1 h nebyly obcházeny. Samostatný test Zernio ve 22:06 znovu poslal schválenou vstupní šablonu pro existující vlastní test 2. 10. 05:00; HTTP 200 a ID zprávy, zatím pouze Sent, uživatel potvrdil nedoručení. To NENÍ úspěšný end-to-end test. Fakturační údaje upravil a ověřil uživatel sám. Další stav a konkrétní kroky: docs/DISCUSSION_AUDIT_2026_09_24.md.

---

# Rozšíření kalendáře na 180 dní — 23. 9. 2026

Na žádost uživatele se limit úvodního kalendáře zvyšuje z 90 na 180 dní. Počet přednačtených dní zůstává 4. Na další přání uživatele se drží pouze tyto první 4 dny a již navštívené dny v okně ±2 od vybraného data (nejvýše 9 dní dohromady). Vzdálenější položky se zahazují; návrat na ně znamená nový požadavek. Sousední dny se nepřednačítají. Produkční `booking.horizon_days` byl sjednocen ze 130 na 180, aby šly pozdější nabízené termíny také objednat. Testy hranic upraveny na den 180/181. Předchozí ověření 90denního chování níže je historické.

# Lazy kalendář na úvodní stránce — 23. 9. 2026

Kalendář prochází až dnešek + 90 dní (pražský čas), začíná prvním rezervovatelným dnem. Úvodní stránka předává přesně první 4 dny. Další vybraný den načítá přes `GET /api/availability/day?date=YYYY-MM-DD`, s kontrolou hranic, `no-store`, bez údajů zákazníků. Úspěšné odpovědi zůstávají v paměti komponenty; opuštěné požadavky se ruší, po 15 s je dostupné opakování. Odkazy do rezervací na homepage a v headeru nepřednačítají rezervační stránku. Zrušené staré nastavení `hero.preview_days` se již nečte ani nenabízí k úpravě.

Ověřeno v Chrome: čtyři dny bez dodatečných požadavků, pátý den načten jediným požadavkem, návrat využívá cache; desktop a klávesnice včetně focus. HTTP kontrola potvrzuje pouze 4 data se sloty v HTML, samostatný den na hranici 90 dní a odmítnutí dne 91. Problémy s ovládáním Chrome zabránily úplné matici šířek a zoomu; otevřený bod v NEEDED.md. Testovací databáze je lokální `codex_navi_access_test`, není produkční.

---

# Uzavírání diskuze — 23. 9. 2026

PR #67 nasazený na produkci (READY, 3e992d5). Živé storno vlastního testu ověřeno v Gmailu ve 14:06; Nuki watchdog online ve 14:06, žádné blokace revokací. Google e-mail doložil vlastníka „NAVI Private Gym“.

Aktuální změny, externí blokery a důkazy jsou v [DISCUSSION_AUDIT_2026_09_23.md](docs/DISCUSSION_AUDIT_2026_09_23.md). Storno e-mail má trvalou frontu; GA4 purchase je doplněný; Nuki má samostatný dohled; Zernio test kontroluje doručení a bezpečně opakuje jen jasná odmítnutí. WhatsApp billing eligibility stále blokuje živé doručení. Testovací allowlist nerozšiřovat bez dokončeného doručovacího testu.

Oprava staršího záznamu níže: všechna tři neprovedená odebrání již produkční watchdog dokončil, access_revocation_pending = 0. Historické selhání vytvoření kódu pro minulý test 22. 9. zůstává otevřené.

---

# Obnova Nuki po výpadku — 23. 9. 2026

PR #66 zavádí trvalé šifrované úlohy PINů, přípravu -24 h, e-mail -1 h,
neomezenou obnovu s odstupy a ověřené odebrání s blokací termínu. Detaily a
bezpečný rollout/rollback: [ACCESS_CODE_RECOVERY.md](docs/ACCESS_CODE_RECOVERY.md).
Migrace aplikovaná na produkční projekt `rkmunagymohxtclymacm`, nový klíč uložený
jako sensitive environment variable pouze ve Vercel Production. **Klíč
nepřepisovat ani nerotovat bez přešifrování existujících úloh.** RLS zapnuté,
žádné granty anon/authenticated k access_code. Tři historické blokace předány
obnově; neoznačovat je ručně za vyřešené bez potvrzení Nuki.

Ověření: 199 unit a 37 integračních testů v samostatné lokální DB
`codex_navi_access_test`, lint, typecheck, format, audit (0 zranitelností),
produkční build a Vercel preview úspěšné. Responzivita na 8 šířkách a keyboard
scroll tabulky ověřeny. Žádná skutečná platba ani otevření dveří při těchto testech.
Produkce c9c43ba byla READY, živá administrace ověřena a watchdog zpracoval všechny tři staré blokace; odebrání zatím nepotvrzené, další pokusy naplánované. Následná oprava ukládá ID zařízení také pro staré úlohy odebrání (10 cílených integračních testů opět prošlo). Fyzický test klávesnice po výpadku zůstává v NEEDED. WhatsApp stále jen stávající
testovací rozsah, nerozšiřován na všechny zákazníky. Purchase beze změny.

Pracovní kopie této změny: `gym-plzen-access-recovery`; původní špinavé kopie
`gym-plzen` a `gym-plzen-launch` nebyly měněny.

---

# Události rezervace 22. 9. 2026 večer — zpráva z Chromu byla mylná

Claude in Chrome (účet NAVI) hlásil Lukášovi, že pixel posílá jen `PageView`
a „v JS bundlech webu není žádné volání `fbq('track', …)` pro Purchase,
InitiateCheckout, Schedule“, takže Ads Manager ukazuje Nákup jako „Inactive
event“ a je třeba doplnit kód. Není to tak; agent hledal doslovný řetězec,
který v kódu není (`trackMetaEvent` předává název události jako proměnnou, v
bundlu je `(0,k.Jz)("InitiateCheckout",{value:…,currency:"CZK"},"reservation:…:checkout")`),
a rezervaci nedokončil, takže `Purchase` vidět nemohl.

**Důkaz 1, živé bundly:** `app/rezervace/udaje/page-d932f551f99d33b8.js`
nese `InitiateCheckout` (po úspěšném odeslání formuláře, těsně před
přesměrováním na Comgate) a `app/rezervace/hotovo/page-8ec1394689c569d8.js`
nese `Purchase` s `{value: cena/100, currency}` i `Schedule` pro bezplatnou
rezervaci; obojí s `eventID`. **Důkaz 2, průchod v prohlížeči** (lokální
produkční build s testovacím ID pixelu `1000000000000000`, náhradní brána
Comgate z `tests/integration/mocks.ts`, `fbevents.js` blokovaný, takže volání
zůstala ve frontě stubu a nic neodešlo): po „Povolit vše“ fronta na stránce s
údaji `["init"], ["track","PageView"] ×2, ["track","InitiateCheckout",{"value":229,"currency":"CZK"},{"eventID":"reservation:<id>:checkout"}]`;
po vypořádání platby (`settle` + webhook `/api/webhooks/comgate`) a otevření
návratové adresy `/rezervace/hotovo?reservation_id=…&token=…` stránka
„Rezervace je potvrzená“ a fronta
`["track","Purchase",{"value":229,"currency":"CZK"},{"eventID":"reservation:<id>:purchase"}]`;
řádek rezervace `confirmed`, 22900 haléřů.

**Proč Meta ukazuje „Inactive“.** Dataset `1393792405627460` dostává události
až od 22. 9. 14:39 UTC a nikdo zatím nezaplatil s povoleným marketingem; Meta
označuje událost jako neaktivní, dokud ji nedostane. Nákup jde v kampani vybrat
i tak, aktivní bude po první skutečné platbě (zkušební rezervace, vrácení
v Comgate — krok 3 v NEEDED). Z téže zprávy platí: CTA „Book now“ se v češtině
zobrazuje jako „Rezervovat“ a pole se ukáže až po nahrání kreativy; před prvním
publikováním chce Meta beneficienta a plátce (#3858152); nepublikovaný draft
„New Sales Campaign“ doporučeno smazat. Vše doplněno do úkolu Meta v NEEDED.

**Poznámky k opakování sondy.** Ochrana proti opakovanému webhooku ukládá
`webhook_event` (`comgate`, `TEST-0001:PAID`): druhý běh proti téže databázi
skončí na „Platbu ještě ověřujeme“, dokud se řádky `TEST-%` nesmažou (spolu s
`payment` a rezervacemi `probe-%@example.test`). `kill` procesu `npx next
start` nechá `next-server` poslouchat dál — ukončit `pkill -9 -f '^next-server'`,
jinak další start skončí `EADDRINUSE` a sonda běží proti starému serveru.
Automatický test událostí pixelu v rezervaci neexistuje (`booking-flow.spec.ts`
odklikává „Pouze nezbytné“); dnešní ověření je ruční, skript zůstal mimo
repozitář.

# Konzole webu 22. 9. 2026 večer — hlášky CSP od pixelu a chybějící favicon

Lukáš poslal konzoli z `www.navigym.cz`: dvě hlášky „Refused to connect …
violates … connect-src“ pro
`https://dv-c3e594c6d429469e90b54478358619c3.ecs.us-east-1.on.aws/events?cee=no`
a `https://bded8a3c6ae-1-1053047382554.us-central1.run.app/events?cee=no`,
a `favicon.ico` 404.

**Co ty hosty jsou.** Konfigurace, kterou Meta pro dataset `1393792405627460`
vrací (`connect.facebook.net/signals/config/1393792405627460`), má sekci
`openbridge` s `endpoints: [{ endpoint: "https://dv-…on.aws/", fallbackDomain:
"https://…run.app", enrichmentDisabled: true }]`. OpenBridge je prohlížečová
část Conversions API Gateway: `fbevents.js` (2.9.406) pošle každou událost
dvakrát — obrázkovým beaconem na `https://www.facebook.com/tr/` (standardní
pixel) a `fetch` POSTem na endpoint gateway `/events?cee=no` (`cee=no` je jen
překlad `enrichmentDisabled`). Obě kopie nesou totéž `event_id`
(`ob3_plugin-set_…`), Meta je deduplikuje. Naše CSP (`next.config.ts`,
`connect-src`) povoluje `https://www.facebook.com`, ale žádný host na
`on.aws`/`run.app`, takže druhý kanál prohlížeč zablokuje a zaloguje; první
projde. Reklama tedy o `PageView` ani `Purchase` nepřichází; blokovaná je jen
serverová kopie téže události. Kdo gateway zřídil, odsud vidět není (NAVI ji
nezakládalo) — v Events Manageru → dataset → Settings → Conversions API.

**Ověření na živém webu** (Chromium, assety přes curl kvůli proxy, běžný UA).
Po „Povolit vše“: `fbq.getState()` pixel `1393792405627460`, `eventCount: 1`;
zachycené odchozí požadavky
`img https://www.facebook.com/tr/?id=1393792405627460&ev=PageView&dl=https://www.navigym.cz/&eid=ob3_plugin-set_…`
a `fetch https://dv-…on.aws/events?cee=no` s tělem
`{"event_name":"PageView",…,"event_id":"ob3_plugin-set_…"}`. Nic z toho sandbox
neopustilo (patch `sendBeacon`/`fetch`/`XHR`/`Image.src` v init skriptu plus CDP
blocklist), dataset z ověření nic nedostal. Poučení: s výchozím headless UA
`fbevents.js` událost napočítá, ale neodešle (`IS_HEADLESS` podle
`/HeadlessChrome/` v UA) — proto odpolední sonda „neviděla“ žádný beacon. Dva
běhy sondy přeposlaly přes curl po jednom GA4 `collect` hitu, takže v GA4 může
být z 22. 9. ~16:20 UTC jedna návštěva navíc; třetí běh už mimo web a skripty
Meta/Google nic nepouštěl.

**Rozhodnutí: CSP neměnit,** dokud Lukáš nerozhodne (položka v NEEDED). Hosty
jsou náhodné, vázané na dataset a mohou se změnit; wildcard `https://*.on.aws
https://*.run.app` by otevřel `connect-src` libovolné aplikaci na AWS/GCP. Když
gateway chceme, přidají se do `connect-src` právě ty dva hosty.

**Favicon.** `/favicon.ico` neexistoval (jen `src/app/icon.png`), prohlížeče,
správci záložek a náhledy odkazů ho žádají bez ohledu na `<link rel="icon">`.
Přidán `src/app/favicon.ico` (16, 32 a 48 px, 32bitové BMP položky) vygenerovaný
ze `src/app/icon.png` přes `sharp` (skript zůstal mimo repozitář, `sharp` není
naše přímá závislost). Next ho servíruje na `/favicon.ico` a vykresluje druhý
`<link rel="icon">`; homepage e2e test v `tests/e2e/public.spec.ts` počítá s
oběma odkazy a `docs/DESIGN_SYSTEM.md` říká generovat obojí spolu.

# Meta pixel 22. 9. 2026 odpoledne — proč reklama neviděla rezervace

Klára a Renáta nemohly v Ads Manageru vybrat nákup rezervace jako cíl reklamy.
Příčina ověřená na živém webu (SSR text `/ochrana-soukromi` a literál v
klientském bundlu `app/layout-…js`) a potom ve Vercelu: `NEXT_PUBLIC_META_PIXEL_ID`
je od 9. 9. `1816423579552231` — Klářin pixel z éry NAMASTÉ (s odřádkováním na
konci, které kód ořízne) — a firemní portfolio NAVI žádný pixel nevidí, takže do
reklamního účtu NAVI nedorazí ani `PageView`, natož `Purchase`. GA4 je v pořádku
(`G-8FN17RXP1T`). Web sám nákup měří: po marketingovém souhlasu `PageView`,
`InitiateCheckout` při odeslání údajů a na stránce potvrzení `Purchase` s částkou
(u bezplatné rezervace `Schedule`).

**Rozhodnutí (dvě):** dopoledne ponechat Klářin pixel (ve Vercelu jen vyčištěná
hodnota; Preview záměrně bez ID, aby zkušební rezervace z preview nasazení
nechodily do reklamních dat jako nákupy). Odpoledne Claude in Chrome v portfoliu
NAVI zjistil, že si přístup k cizímu pixelu vyžádat nejde — nové rozhraní má pod
„Add“ jen „Create a new dataset“ — a že dopolední dataset „NAVI Private Gym –
navigym.cz“ má ID `1393792405627460` a hlásí „not receiving events“. Protože
Klářin pixel nemá pro NAVI žádnou nákupní historii (gym otevírá 1. 10., jsou na
něm jen návštěvy z namastegym.cz) a sdílení by záviselo na krocích v jejím
portfoliu, web se přepnul na dataset NAVI: `NEXT_PUBLIC_META_PIXEL_ID` =
`1393792405627460`, nasazeno z `main`. Klářin pixel `1816423579552231` zůstává
nedotčený. Přiřazení datasetu reklamnímu účtu, doména a Test events jsou v NEEDED.

Ověřeno po přepnutí (build `dpl_pf1HmErN5BbHujoH3wdGzTzRp1Ha` z `708e546`,
READY 14:39 UTC, alias `www.navigym.cz`): `/ochrana-soukromi` uvádí „Pixel s ID
1393792405627460“, klientský bundle `app/layout-…js` nese
`META_PIXEL_ID:"1393792405627460"` a v Chromiu po „Povolit vše“ `fbq.getState()`
hlásí pixel `1393792405627460` s jednou zaznamenanou událostí (`PageView`);
beacony na `facebook.com/tr` byly zachycené a zahozené, dataset z ověření nic
nedostal. První skutečná událost tedy dorazí od prvního návštěvníka, který
marketing povolí.

**Doména pro Meta (16:00 UTC).** Reklamní účet byl k datasetu už připojený, ale
`navigym.cz` v portfoliu neexistovala a Meta bez ověřené domény kampaň na web
nepustí. DNS zóna je u WebSupportu (`ns1.websupport.cz`), TXT záznam tedy odsud
přidat nejde; zvolena metoda meta tagu: `siteVerification` v
`src/lib/config/site-verification.ts` (čistý helper, unit test) plní
`metadata.verification.other` v root layoutu z `META_DOMAIN_VERIFICATION`
(`src/lib/env.ts`, `.env.example`, `MANUAL_STEPS.md`); bez hodnoty se nevykreslí
nic (`55a516b`). Claude in Chrome doménu přidal (ID 2345774789562842) a opsal
kód; ten je ve Vercelu jen pro Production. Po deployi je tag v `<head>` na
`www.navigym.cz` i při čtení `navigym.cz` s následováním přesměrování, tak jak
ho bude číst crawler Mety. Zbývá kliknutí „Verify Domain“ (v NEEDED). V Events
Manageru → Actions svítí dvě doporučení na Conversions API — upsell, zatím
neřešeno; přehled hlásí „Finish setting up Meta Pixel – 0 %“, což zmizí s první
událostí od návštěvníka, který povolí marketing.

Ověřeno před přepnutím na živém webu (Chromium; HTML, chunky i `fbevents.js` přes curl, protože
sandboxová proxy zahazovala dávky požadavků; beacony na `facebook.com/tr`
zachycené a zahozené, na pixel nic nedorazilo): lišta nabízí Analytiku i
Marketing, po „Povolit vše“ se načte `fbevents.js` 2.9.406 a konfigurace
`signals/config/1816423579552231`, `fbq.getState()` hlásí pixel
`1816423579552231` s jednou zaznamenanou událostí (`PageView`). Produkční deploy
z `a6cf8e0` má v bundlu hodnotu už bez odřádkování. Chování pixelu kryjí i e2e
testy proti produkčnímu buildu (zápis níže).

# Měření, cookies a úklid 22. 9. 2026 — dokončení přerušené session

Předchozí session skončila uprostřed práce na Meta pixelu (došel limit) a
nedokončila ani obvyklý závěr: od 18. 9. nepřibyl žádný zápis sem ani do
`NEEDED.md`, ačkoli mezitím přibylo dvanáct commitů. Tenhle zápis to dohání a
opravuje tři věci, které se při tom našly.

- **Zásady ochrany soukromí uváděly cizí měřicí ID** (`5e298f3`). Stránka
  `/ochrana-soukromi` měla v textu natvrdo GA4 `G-6L9N41NKT8` a Meta Pixel
  `1816423579552231` — což jsou **zrušené účty z éry NAMASTÉ**. Měření samo se
  přitom už od rebrandu řídí proměnnými `NEXT_PUBLIC_GA_MEASUREMENT_ID` a
  `NEXT_PUBLIC_META_PIXEL_ID`, takže právní dokument tvrdil návštěvníkovi něco
  jiného, než co by se v prohlížeči skutečně načetlo. Sekce teď čte tutéž
  konfiguraci jako `meta-pixel.ts` a lišta souhlasu. Když ID nastavené není,
  stránka to řekne („Pixel zatím nemáme nastavený…“) místo aby jmenovala
  neexistující pixel — a to je přesně dnešní stav, dokud se nedoplní ID nového
  datasetu. Unit test `analytics.test.ts` sice už dřív vyžadoval, aby ID žila v
  prostředí, ale kontroloval jen `config/analytics.ts`; hlídá teď i tuhle
  stránku. E2E aserce na ten starý pár by po zrušení účtů mlčky procházela dál,
  proto se řídí prostředím buildu.
- **Testy souhlasu s cookies neseděly na klíč, který web zapisuje** (`41debc3`).
  `ded8877` přejmenoval uloženou volbu na `navi:tracking-consent-v2`, ale
  `tests/e2e/analytics.spec.ts` dál mazal a četl `namaste:tracking-consent-v2`.
  Dva ze čtyř testů proto porovnávaly `null` a padaly, a žádný z nich
  nezačínal s čistým stavem, protože mazal jiný klíč, než jaký stránka ukládá.
  Po opravě prochází všechny čtyři proti produkčnímu buildu: bez souhlasu se
  nenačte ani gtag, ani `fbevents.js`; Analytika a Marketing jsou nezávislé
  volby; pixel a PageView naskočí až po marketingovém souhlasu; a odvolání
  souhlasu maže `_fbp`/`_fbc` i `_ga*`.
- **Proměnné Zernio nebyly v `.env.example`** (`1781e20`). `ee0d085` je přidal
  do schématu serveru, ale nikam je nezapsal, takže allowlist, který celou
  zkušební WhatsApp cestu omezuje na jediného příjemce, nebyl odnikud vidět.
- **Formát** (`127b38a`): commity z 20. 9. neprošly formátovačem, takže
  `npm run format:check` hlásil šestnáct souborů. Jen formát, žádná změna
  chování.

**Co se mezitím událo a nebylo zapsané** (19.–22. 9.):

- **Rezervační formulář přežije ztracenou odpověď** (`bb0939e`) a kalendář na
  úvodní straně má jednodušší datum bez sloupce s časem doručení (`d84b2fd`).
- **Kontaktní odkaz na WhatsApp** míří do schránky NAVI Business (`f4c191d`).
- **Nuki vstupní kódy** (`a185615`, `4031404`, `d29f6d2`): PIN vzniká až hodinu
  před rezervací, platí přesně od jejího začátku do konce plus doba na sprchu a
  odesílá se e-mailem (Resend) teprve poté, co Nuki potvrdí autorizaci, časové
  meze i dokončenou synchronizaci. Asynchronní `PUT` vrací 204 bez id, takže si
  je adaptér dohledá ve výpisu autorizací; nejasné výsledky dorovná watchdog bez
  dalšího `PUT`. Podrobnosti v [docs/NUKI_EMAIL.md](docs/NUKI_EMAIL.md).
- **Administrace → Vstupní kódy** (`ad1a1f6`, `b9a7394`, `80b507b`, `797b73f`,
  `fa35422`): přehled kódů s platností a odkazem na zákazníka, ověřené použití
  klávesnice a počty neúspěšných pokusů (neúspěšné zamykání se mezi pokusy o
  vstup nepočítá).
- **Náhled odeslaných e-mailů** (`540fb67`): přesné znění zprávy se ukládá do
  nové tabulky `email_archive` a maže se po 30 dnech hodinovým cronem
  `/api/cron/purge-email-archive`. Migrace `drizzle/20260920190156_email_archive.sql` jako jediná z poslední řady
  neměla zápis v `NEEDED.md`; odpoledne ověřeno přes Supabase, že v produkci
  je (tabulka, index, RLS, historie migrací 20. 9. 19:02) — zapsáno jako hotové.
- **Zkušební WhatsApp se vstupním kódem přes Zernio** (`ee0d085`): zpráva odejde
  jen tehdy, když se telefon **i** e-mail rezervace shodují s
  `ZERNIO_TEST_RECIPIENT` a `ZERNIO_TEST_EMAIL`. Ostatním zákazníkům nechodí nic,
  e-mail zůstává povinným kanálem a selhání testovacího kanálu nikdy nezdrží
  povinný e-mail. Odeslání si zabírá `message_delivery.dedupe_key`, takže
  opakovaný fulfillment druhou zprávu nepošle.

**Ověřeno.** 194 unit testů, 27 integračních proti lokálnímu Postgresu (po
`db:seed`; bez osazeného rozvrhu padají na „termín není dostupný“, což není
chyba kódu), 4 testy souhlasu a 14 testů veřejného webu v Chromiu proti
produkčnímu buildu, formát, lint, typecheck, `npm audit --omit=dev` bez nálezu a
produkční build. Sekce „Externí služby na webu“ ověřena v prohlížeči v obou
stavech: s nastaveným ID vypíše to ID, bez něj větu, že nastavené není.

**Co zbývá provozovateli** (v NEEDED): přiřadit dataset NAVI reklamnímu účtu (zápis výše),
dokončit zkoušku vstupu přes Nuki (22. 9. nebyla připojená klika), případně nastavit Zernio.

# Provozní upozornění 18. 9. 2026 — e-maily pro provozovatele

Co se v systému stane, se teď dá poslat e-mailem lidem, kteří posilovnu
provozují. Zákazníkům tyto zprávy nechodí.

- **Nastavení** (administrace → Nastavení a branding → **Provozní upozornění**):
  adresy (více oddělených čárkou, nejvýše 5) a zaškrtávátko u každé události.
  Konfigurace je v `site_setting` pod klíčem `notifications.operator`
  (`src/lib/config/operator-notifications.ts`). Dokud nikdo nic neuložil, platí
  výchozí stav: adresa = kontaktní e-mail webu (`contact.email`, dnes
  `info@navigym.cz`) a zapnuté události Nová rezervace, Změna termínu a Provozní
  problém. Prázdné pole adres odesílání vypne.
- **Události** (`OPERATOR_EVENT_DEFINITIONS`): `reservationConfirmed` (potvrzená
  rezervace, i na voucher a věrnostní vstup), `reservationRescheduled` (zákazník
  si přesunul termín), `reservationCancelled` (zrušená **potvrzená** rezervace;
  vypršelý hold ani zamítnutý voucher se nehlásí), `memberRegistered` (dokončená
  registrace) a `systemAlert` (vše ze sekce Upozornění — dnes jediná cesta, jak
  se ke správci dostane kritická chyba, protože WhatsApp skupina ještě není
  zapojená).
- **Kde se to spouští**: `fulfillment.fulfillReservation` (hned po potvrzovacím
  e-mailu zákazníkovi), `rescheduling.rescheduleReservation`,
  `reservations.cancelReservation` (jen u potvrzené rezervace),
  `alerts.raiseAlert` a `members.recordRegistration`, kterou volají routy
  `/auth/confirm` (potvrzení e-mailu) a `/auth/callback` (první přihlášení přes
  Google, poznané podle stáří účtu). Žádné z volání nemůže shodit akci, kterou
  popisuje: `notify` chyby loguje a polyká.
- **Jednou a dost**: každé upozornění nese `scope` (id rezervace, id člena, id
  alertu) a zabírá si ho v `message_delivery.dedupe_key` ještě před odesláním
  (`kind = 'operator_notice'`; migrace `20260918090000_operator_notifications.sql`
  přidává hodnotu enumu, sloupec a unikátní index). Watchdog může fulfillment
  opakovat, druhý e-mail už nepošle. Neúspěšné odeslání klíč uvolní, takže
  příští pokus to zkusí znovu, a v administraci → Odeslané zprávy je vidět jako
  „Upozornění pro provozovatele“ ve stavu selhalo.
- **Text e-mailu** je šablona `operator_notice` v administraci → E-maily, takže
  jde upravit i s náhledem a testovacím odesláním. Proměnné `{event}`,
  `{summary}`, `{detail}`; tlačítko vede do administrace (`sendTransactionalEmail`
  nově přijímá `actionUrl` a adresu zopakuje i v textové části, aby odkaz
  nezmizel v klientovi bez HTML). Volný text (důvod storna, tělo alertu) patří
  do `{summary}`, protože detailní řádky jsou tabulka.
- **Historie akcí** zná nově `member.registered` (dokončená registrace) a
  `settings.operator_notifications_saved`.
- **Sdílený řádek se zaškrtávátkem**: revize design systému našla, že nativní
  20px box nesplňuje 44px cíl a že se vzor psal pokaždé znovu. Vznikla
  `CheckboxRow` (`components/admin/form-controls.tsx`): 44px řádek, kurzor a
  hover jako u ovládacího prvku, vysvětlující věta pod popiskem svázaná přes
  `aria-describedby` (nikdy součást popisku). Používají ji obě karty Nastavení,
  je popsaná v `docs/DESIGN_SYSTEM.md` a vykreslená v `/admin/design-system`.
  Starší `CheckboxField` (16px box, mrtvé třídy `rounded border-input`) zbývá
  převést — úkol v NEEDED.
- **Chyba pole se zase ohlásí**: `Field` přidává `aria-describedby` jen
  ovládacímu prvku, který si žádné nenastavil, takže statické `recipients-help`
  by chybovou hlášku umlčelo. Pole teď uvádí obě id.
- **Resend a limit rychlosti**: potvrzená rezervace pošle e-mail zákazníkovi a
  hned nato upozornění provozovateli, což je přesně dávka, kterou Resend
  odmítá (dvě požadavky za sekundu). `sendEmail` po odmítnutí
  `rate_limit_exceeded` počká a zkusí to ještě jednou; stand-in v testech to umí
  simulovat (`resend.rateLimitNext()`).
- **Ověřeno**: unit i integrační testy (nový soubor
  `tests/integration/operator-notifications.test.ts`: doručení na dvě adresy,
  vypnutá událost, prázdné adresy, změna a storno, vypršelý hold, alert, uložení
  z administrace), lint, typecheck, `npm audit --omit=dev` bez nálezů, produkční
  build. V prohlížeči: 44px řádky, `aria-describedby` u každé volby, viditelný
  focus, žádný overflow 320–1728 px. Integrační `resetDatabase` upozornění vypíná,
  aby ostatní sady viděly jen e-maily zákazníka.

# Pět úprav 18. 9. 2026 — září, kalendář, telefon, e-maily, stránkování

Zadání provozovatele, pět bodů, každý ve vlastním commitu na
`claude/exciting-hopper-nexmb0`.

- **Září už nikde není** (`3d2048b`): posilovna se otevírá 1. 10., ale oba
  kalendáře září nabízely. Veřejný sice začínal na otevíracím dni, listování
  zpět ale ukázalo měsíc přeškrtnutých dnů; kalendář změny termínu v profilu
  klienta na září přímo začínal a předvybral dnešek, kde rezervovat nelze.
  `firstBookableDateKey` (přejmenované `initialBookingDateKey`, počítalo už
  dřív ten samý den) je teď dolní hranice obou: listování se na otevíracím
  měsíci zastaví a `?month=2026-09` i `?date=2026-09-20` spadnou na říjen. Pod
  mřížkou je věta „Termíny přijímáme od 1. října 2026, nejvýše 60 dní od
  dneška.“ Mřížka má jedno tabové zastavení, a to na dni, který jde vybrat;
  dřív padlo na dnešek, takže měsíc otevřený tlačítkem „Následující měsíc“
  neměl ani výběr, ani dnešek a z klávesnice se do něj nedalo dostat. Den
  „před otevřením“ (zakázaný s vlastním důvodem pro čtečku) v prohlížeči
  neuvidíte: otevírací den je prvního, takže žádný takový den v zobrazeném
  měsíci není — je to připravené na otevření uprostřed měsíce. Po revizi
  design systému dostaly důvod i nevybratelné dny v kalendáři změny termínu
  (dřív byly celé `aria-hidden`) a ani jeden kalendář už nepředvybere den
  mimo rezervační horizont.
- **Jedno tlačítko do kalendáře** (`55f974a`): „Přidat do kalendáře“ (stažení
  `.ics`) zmizelo, protože tentýž soubor je přílohou potvrzovacího e-mailu;
  zůstalo „Přidat do Google Kalendáře“. Trasa `/api/reservations/[id]/calendar.ics`
  zůstává (autorizovaná po rezervaci, obsah přílohy), jen na ni nic neodkazuje.
- **Telefon do profilu** (`ad304bf`): pod polem telefonu má přihlášený člen
  zaškrtávátko „Uložit telefon do profilu a příště ho předvyplnit“. Zápis
  proběhne po vytvoření rezervaci a nikdy jí nestojí v cestě (selhání se jen
  zaloguje) a dotkne se jen řádku, kde je číslo skutečně jiné — potvrzení
  nezměněného čísla tedy nezahodí ověření, změněné číslo ověření ruší, stejně
  jako formulář profilu. Host zaškrtávátko nevidí, nemá kam ukládat.
  Integrační soubory od teď běží po jednom (`--test-concurrency=1`): paralelně
  jeden soubor smazal voucher, s kterým druhý zakládal rezervaci, a dva
  procesy se sousedním PID si sahaly na stejný port náhradní služby.
- **E-maily** (`f96e6ec`): obálka je nová — vnořené tabulky s inline styly
  (to jediné umí každý klient včetně Outlooku), 600 px na střed, linka `ink`,
  logo, tělo, nejvýš jedno tlačítko a patička s adresou webu. Odstavec, jehož
  každý řádek je „název: hodnota“, se vykreslí jako tabulka detailů, takže
  potvrzení vede termínem, délkou a cenou; próza (i s odkazem) zůstává prózou.
  Barvy obálky dřív byly hodnoty, které nejsou v paletě; teď každá zrcadlí
  token z `globals.css` (v e-mailu nelze číst CSS proměnnou, takže je to
  jediné povolené místo, kde se tokeny opisují). Text šablon je pořád zdrojem
  pravdy a jde do zprávy jako plaintext.
- **Stránkování historie akcí** (`c5ef312`): `/admin/activity` čtelo 200
  nejnovějších řádků a zbytek historie byl nedosažitelný. Čte po 50, nejnovější
  nahoře, přes společné `Pagination` a `helpers/pagination` (o řádek víc, než
  je stránka — tím se pozná další stránka bez počítání tabulky). Historie
  objednávek v účtu používá totéž místo své kopie; jediná stránka nevykreslí
  nic. Zdokumentováno v `docs/DESIGN_SYSTEM.md` a v `/admin/design-system`.

**Ověřeno.** 165 unit testů, 16 integračních proti lokálnímu Postgresu (nově
paging historie akcí a zápis telefonu do profilu), formát, lint, typecheck,
produkční build, `npm audit --omit=dev` bez nálezu. V Chromiu proti lokálnímu
dev serveru: říjen jako výchozí měsíc a zakázané listování zpět, obě spadnutí
ze září, listopad dosažitelný z klávesnice, šipky/Enter/PageUp v mřížce,
potvrzená rezervace s jediným odkazem do Google Kalendáře (44 px, 3px fokus),
zaškrtávátko telefonu (44 px řádek, pořadí Tab telefon → uložit → voucher,
Space přepne), stránkování v administraci (prázdná první stránka pager
nevykreslí, `?page=3` má „Předchozí“) a šířky 320–1728 px bez vodorovného
přetečení. Všech sedm e-mailů vykresleno v prohlížeči na 360 a 680 px; kontrast
textu na bílé, na výplni detailů i v patičce je nad AA.

**Co zbývá provozovateli** (v NEEDED): potvrdit datum otevření se správkyněmi,
po nasazení znovu uložit obě šablony Supabase Auth (hostované HTML se propíše
teprve uložením) a prohlédnout si nové e-maily v Gmailu, Outlooku a na iPhonu.
Kalendář změny termínu jsem v prohlížeči neotevřel: lokálně není přihlášení
přes Supabase, takže jeho stránku nelze načíst; logiku má společnou s veřejným
kalendářem a krytou testem `tests/unit/booking-start.test.ts`.

---

# E-maily 17. 9. 2026 odpoledne — propsání do Supabase Auth, značka, čitelnost

Třetí část session po nasazení administrace (`146343c`):

- **Propsání šablon do Supabase Auth** (`1d20b38`): operátor doplnil
  `SUPABASE_MANAGEMENT_API_TOKEN`, ale stránka E-maily tvrdila synchronizaci
  bez ohledu na token a neúspěšný PATCH hlásila stejně jako chybějící token.
  Stránka teď čte hostovanou konfiguraci (`checkSupabaseAuthTemplateSync`) a
  nad šablonami říká, zda token funguje, která šablona ještě nemá náš odkaz a
  jaké je jméno odesílatele SMTP; neúspěšné uložení vrací HTTP stav a hlášku
  API (`SupabaseAuthSyncResult`). Po nasazení operátor obě šablony uložil
  („Šablona uložená a propsaná do Supabase Auth“) a ověření prošlo: registrace
  i obnova hesla česky, předmět „… | NAVI Private Gym“, odesílatel
  `NAVI Private Gym <noreply@navigym.cz>`, odkaz `/auth/confirm?token_hash=…`
  dokončil přihlášení v úplně novém prohlížeči, nové heslo přihlásilo.
- **Značka v odesílateli**: Resend i SMTP Supabase Auth posílaly jako „Namasté
  Private Gym“ (proměnná `RESEND_FROM_EMAIL` ve Vercelu a Sender name v
  Supabase). `brandedSender` bere z proměnné jen adresu, propsání šablon
  nastavuje `smtp_sender_name`, `brandedSubject` sjednocuje předměty na
  „… | NAVI Private Gym“ při čtení i uložení. V kódu ani v produkčním obsahu
  žádná zákaznická stopa NAMASTÉ nezůstala (`tests/unit/brand.test.ts`).
- **Čitelnost a zpětná vazba** (`e7dbde9`): žlutý tón `Notice` používal bílý
  `warning-foreground` na 15% tintu; všechny tóny mají text `foreground`
  (pravidlo v `docs/DESIGN_SYSTEM.md`, test `notice-contrast.test.ts`).
  Hláška po uložení šablony mizela po sekundě, protože ji mazal efekt
  reagující na nová data po `revalidatePath`; maže se jen při přepnutí šablony.
- **Úklid**: zkušební účty `kouril.lukas+navi-auth-test@` a `+navi-auth-test2@`
  smazány (auth.users i profiles), zkušební rezervace 22. 10. 22:30 zrušena
  s `cancel_reason = integration_check` a claim voucheru `TESTNAVI5555XX`
  uvolněn; termín je na webu opět volný.
- **Nuki**: provozovatel rozhodl, že bez kliky zákazníci nevstupují; otevření
  1. 10. 2026, zámek bude připojený dřív. Před zapnutím kódů zbývá issue #64
     (`[owner:ai]` v NEEDED).

# Administrace 17. 9. 2026 — profil člena, historie akcí, texty

Druhá část session po sloučení oprav rezervačního průchodu (`e5b22e1`):

- **Historie akcí** (`/admin/activity`, tabulka `activity_log`, migrace
  `drizzle/20260917120000_activity_log.sql`, aplikovaná v produkci): potvrzené,
  zrušené a přesunuté rezervace, přijaté i neproběhlé platby, expirace holdů a
  každá změna provedená správcem (ruční rezervace, storno, uzavření termínů,
  vouchery, profily a role členů, cena, cenová období, provozní nastavení).
  Zapisují ji služby a akce, které změnu provádějí (`services/activity.ts`;
  uvnitř transakce `recordIn`, mimo ni `record`, které nikdy neshodí akci).
  Změna termínu zákazníkem se dosud nikde nepropisovala.
- **Profil člena** (`/admin/members/[id]`): účet a kontakt, souhlasy, věrnost,
  všechny rezervace s platbou, voucherem, dokladem a příznakem změny termínu,
  odeslané zprávy, historie akcí a formuláře úprav (přesunuté z výpisu členů).
  Jméno ve výpisu členů i kontakt u rezervace přihlášeného zákazníka na profil
  odkazují; rezervace bez účtu je označená „Bez účtu“. V demo režimu se
  zobrazí fixture člen bez úprav.
- **Texty**: telefon už nechce „E.164“, ale předvolbu s příkladem; stránka
  odeslaných zpráv se jmenuje „Odeslané zprávy“ a překládá kanál i typ; závažnost
  upozornění a akce zámku v knize vstupů jsou česky. Test
  `tests/unit/admin-copy.test.ts` hlídá, že každá uložená hodnota výčtu má
  český popisek.
- Voucher začínající o dvě hodiny později byl důsledek stejné chyby
  `datetime-local` → UTC opravené v první části (`acf0c23`).

Ověřeno: 150 unit a 14 integračních testů, lokální demo administrace v
prohlížeči (nové stránky bez přetečení 320–1728 px, klávesnice na odkaz profilu
s viditelným fokusem), produkční build, `npm audit --omit=dev` 0 nálezů.

---

# Audit rezervačního průchodu 17. 9. 2026 — dva incidenty ze Sentry

**Co se stalo.** V 7:00 ráno začala hostka rezervaci na 1. 10. 7:30, byla
poslána na bránu Comgate a o osmnáct sekund později odeslala formulář znovu.
Její vlastní držený termín se ohlásil jako „Tento termín je již rezervovaný“ a
rezervace skončila v 7:30 vypršením platební relace (`4356f140…`, platba
`ELEE-1J1Q-5VGH` → CANCELLED). Sentry to navíc hlásilo jako chybu, protože
`defineAction` posílal každou očekávanou `ActionError` jako výjimku. Druhý
incident: po změně termínu spadl `/account?zmena=uspesna` na
`TypeError … reading 'getTime'` v `resolveEntryPrice` (zákaznice viděla
„Connection closed“), přestože změna v databázi proběhla a e-mail odešel.

**Opraveno ve větvi `claude/exciting-hopper-nexmb0`** (commity `acf0c23`…):

- Opakované odeslání pokračuje ve vlastní rezervaci: člen podle účtu, host
  podle cookie `navi_hold` (id + potvrzovací token, 35 minut, jen pod
  `/rezervace`) nebo podle zadaného e-mailu pro stejný termín. Nejdřív se dotáhne
  stav platby z Comgate, potvrzený termín odpoví větou, otevřená brána vrátí
  stejnou relaci, voucher zadaný na druhý pokus starý hold nahradí
  (`superseded`). Stránka údajů držitele holdu nevrací na kalendář, ale ukáže
  „Tento termín už pro vás držíme“; tlačítko zůstane po odeslání zablokované,
  dokud prohlížeč neodejde na bránu (a uvolní se po návratu z bfcache).
- `ActionError` je od teď warning breadcrumb, Sentry výjimky zůstávají jen
  pro neočekávané chyby. Logger snese i CommonJS build Sentry SDK (skripty,
  testy).
- Administrace četla `datetime-local` hodnoty v UTC: voucher „od 8:00“ začínal
  v 10:00 (stejně bloky termínů a ruční rezervace). Nový
  `formDateTimeToInstant` bere hodnotu bez zóny jako pražský čas. Dva testovací
  vouchery v produkci (`TESTNAVI5555X`, `TESTNAVI5555XX`) jsem posunul o
  −2 h na zamýšlenou platnost.
- Cena: `resolveEntryPrice` ignoruje období bez platných instantů a pro
  nepoužitelný okamžik vrací standardní cenu místo pádu; `loadSiteContent`
  přijme jen skutečné `Date`. Přesný spouštěč v produkci se z kódu odvodit
  nepodařilo (`now` tam nemůže být `undefined`; stejný průchod se u
  testovacího člena po opravě nezopakoval) — po nasazení sledovat Sentry, a
  pokud se objeví znovu, budu potřebovat přístup k události (Sentry MCP není
  autorizované). Kalendář změny termínu už nevolá `router.refresh()` hned za
  `router.push()`, což byl souběh dvou požadavků na stejnou trasu.
- Potvrzovací e-mail už u vstupu zdarma z voucheru neříká „věrnostní vstup“.
- Potvrzení registrace: výchozí `{{ .ConfirmationURL }}` je PKCE výměna, která
  funguje jen v prohlížeči, kde registrace začala. Ověřeno v produkci: odkaz
  otevřený jinde adresu potvrdí a skončí na `/login?chyba=jiny_prohlizec`.
  Nová trasa `/auth/confirm` ověří `token_hash` na serveru a synchronizované
  šablony na ni odkazují; dokud provozovatel nedoplní
  `SUPABASE_MANAGEMENT_API_TOKEN` a neuloží šablony, chodí anglická výchozí
  šablona Supabase se starým odkazem (viz NEEDED).

**Testy.** 148 unit testů; 12 integračních testů (`npm run test:integration`,
lokální Postgres 16 s aplikovanými migracemi, náhradní Resend a Comgate v
`tests/integration/`) pokrývá hosta i člena s voucherem, desátý vstup zdarma,
placený hold a jeho opakování s cookie i bez ní, vyrovnání a zrušení platby
bránou, voucher na druhý pokus, odmítnutý voucher, vypnuté platby, blok,
expiraci holdu a párování vlastní rezervace; Playwright
`tests/e2e/booking-flow.spec.ts` projde v prohlížeči voucher i návrat z brány
(režim 5 v `tests/e2e/README.md`), veřejná sada 17/17.

**Ověřeno v produkci (`www.navigym.cz`, kód před opravou).** Host s voucherem
`TESTNAVI5555XX`: rezervace `2c4f9ff7…` potvrzená, `/rezervace/hotovo`
v pořádku, potvrzovací e-mail s přílohou `rezervace.ics` dorazil do 4 s
z `noreply@navigym.cz` (doména je v Resendu ověřená). Registrace
`kouril.lukas+navi-clen@gmail.com`: e-mail od Supabase Auth do 2 s, ale
anglický výchozí text; přihlášení heslem, rezervace s voucherem jako člen
(`a21d0d63…`, věrnost 1/10, e-mail s věrnostní větou), změna termínu a
`/account?zmena=uspesna` bez chyby, e-mail „Změna termínu rezervace“ s novou
`.ics`. Zákaznice `bilkova.klara@…` téhož rána zaplatila skutečných 199 Kč
(`HIJ4-JP8D-39HS`), webhook potvrdil rezervaci a e-mail odešel — placená cesta
je tedy ověřená ostrou platbou. Testovací rezervace jsou zrušené
(`integration_check`), claimy voucheru uvolněné, testovací účet smazaný.

**Zámek.** Žádná kontrola v kódu rezervaci s vypnutým Nuki neblokuje:
`fulfillment` označí krok `payment` a skončí, kroky `code_created` /
`code_delivered` čekají `pending` na zapnutí zámku, watchdog je při vypnutém
zámku přeskakuje, storno bez kódů nic neodebírá, `sync-entry-log` bez
přístupů nic nestáhne. Jediné, co s klikou souvisí, je text: potvrzovací
e-mail i účet slibují „osobní vstupní kód před začátkem rezervace“.
Provozovatel 17. 9. rozhodl: bez Nuki zákazníci nevstupují, posilovna se
otevírá 1. 10. 2026 a klika bude do té doby připojená — texty zůstávají a
před zapnutím kódů je nutná oprava #64 (viz NEEDED).

Lokální Postgres pro testy: `pg_ctlcluster 16 main start`, databáze
`gym_test` s rolemi `anon`/`authenticated`, schématem `extensions` a publikací
`supabase_realtime`, migrace z `drizzle/*.sql` v pořadí, `npm run db:seed`.
Chromium v tomto prostředí důvěřuje CA proxy přes NSS databázi
(`certutil -d sql:$HOME/.pki/nssdb -A -t "C,," -i /root/.ccr/agent-proxy-ca.crt`),
takže browser testy proti ostré doméně už jdou spustit.

---

# Oprava 16. 9. 2026 — Google v Safari (#18)

Příčina nalezena. PKCE ověřovatel je cookie hostitele, který přihlášení
**začal**, a kód se vrací na hostitele, kterého má povoleného Supabase.
Prohlížeč flow spouštěl přes `window.location.origin`, takže návštěva, která
přišla na jinou z adres webu, zapsala ověřovatel tam, kam se callback nikdy
nevrací. `https://www.namastegym.cz` dodnes odpovídá 200, zatímco Supabase už
míří na `www.navigym.cz` — kdo měl v prohlížeči starou adresu, přihlášení přes
Google nedokončil. Není to chyba Safari jako takového: selže ten prohlížeč,
který drží starou záložku, a klientka ji měla v Safari. Pěti lidem, kteří
přišli na novou doménu, přihlášení prošlo (`auth.identities`, naposledy 7. 9.).

Oprava: nové `/auth/signin` spouští flow na serveru a **nejdřív** přesune
návštěvu na kanonický původ, takže se ověřovatel zapíše jednou, na hostiteli,
který ho bude číst, a jako skutečná `Set-Cookie` (`Secure; SameSite=lax`)
místo cookie psané skriptem — těm je ochrana soukromí v Safari výrazně méně
nakloněná. Callback, který i tak dorazí jinam, se přepošle místo selhání, a
výměna bez ověřovatele teď hlásí vlastní hlášku, ne „vypršelo“. Tlačítka
poskytovatelů jsou odkazy, takže fungují i bez JavaScriptu.

Ověřeno lokálně proti produkčnímu Supabase: start na kanonickém hostiteli
vrací `Set-Cookie: sb-…-code-verifier; Path=/; Secure; SameSite=lax` a
přesměruje na Google s `code_challenge`; start na `www.namastegym.cz`
přesměruje na kanonickou doménu **bez** zapsané cookie; callback bez
ověřovatele se z cizího hostitele přepošle a na kanonickém skončí na
`/login?chyba=jiny_prohlizec`. Skutečné dokončení v Safari ověří provozovatel
— WebKit tu není a TLS ověření proxy se obcházet nemá.

Pozor na `nextUrl.origin`: hlásí `localhost` bez ohledu na hostitele, kterého
použil prohlížeč, takže porovnání proti kanonické adrese přesměrovává donekonečna.
Hostitel se proto bere z `x-forwarded-host`/`host`; test „the canonical move
cannot loop“ to hlídá.

---

# Nasazeno 16. 9. 2026 — review sloučeno do `main`

Migrace `20260916100000_pipeline_step_unique.sql` je **aplikovaná v produkčním
Supabase** (tabulka `reservation_pipeline` byla prázdná, index
`reservation_pipeline_step_uidx` ověřený v `pg_indexes`), teprve poté se větev
`claude/wizardly-mayer-5v3ihy` sloučila do `main` (merge commit `0e5b011`,
`--no-ff`, bez konfliktů — `main` se mezitím nepohnul). Issues #46–#63 a #65 se
zavřely automaticky; otevřené zůstávají #64 (Nuki, čeká na zámek) a #18.

Znovu ověřeno na merge commitu proti lokálnímu Postgresu se seedem:
format:check, lint, typecheck, 132 unit testů, `npm audit --omit=dev` (0 nálezů),
produkční build a 17/17 veřejných e2e testů včetně „the first date selection on
a fresh calendar always commits“. Build potvrdil i čísla z review: sdílený JS
104 kB, `/rezervace` 143 kB, ISR `5m` na `/faq`, `/doprava-a-platba` a právních
stránkách.

Ověřeno přímo v produkci (`https://www.navigym.cz`): běží merge commit
(`sentry-release=0e5b011d…`), `/faq` vrací `x-nextjs-prerender: 1` a
`x-nextjs-stale-time: 300`, CSP už neobsahuje `'unsafe-eval'`, banner hlásí
„OTEVÍRÁME 1. 10. • VSTUP 199 Kč PO CELÝ ŘÍJEN“ (budoucí čas odpovídá datu) a
`/rezervace` posílá 42 buněk kalendáře bez jediného skeletonu, tedy odstraněné
`loading.tsx` se propsalo.

Dvě poznámky k postupu z minula. Za prvé: Vercel na ISR stránkách neposílá
doslovné `s-maxage=300` — hodnotu si bere edge a prohlížeči vrací
`max-age=0, must-revalidate` plus `x-nextjs-stale-time: 300`. Smoke test proto
kontrolovat podle `x-nextjs-stale-time`, ne podle `s-maxage`. Za druhé: e2e test
výběru dne se v tomto prostředí nedá pustit proti ostré doméně — prohlížeč
nedůvěřuje CA odchozí proxy a TLS ověření se obcházet nemá; test proto běžel
proti produkčnímu buildu lokálně.

Zbývá provozovateli: vizuálně zkontrolovat administraci → Vstupné a věrnost a
→ E-maily (šablona „Změna termínu“) a smazat sloučenou větev na GitHubu —
mazání větví z tohoto prostředí končí na 403. Viz [NEEDED](NEEDED.md).

---

# Aktualizace 16. 9. 2026 — produkční code review a výkon

Kompletní review kódu před spuštěním (mimo Nuki a WhatsApp/Zernio, které se
připojí později). Každý nález má issue na GitHubu (#46–#64); opravy jsou ve
větvi `claude/wizardly-mayer-5v3ihy`, jeden commit na issue, s `Closes #N`.

Opraveno v kódu: časově řízený banner otevření (#46), ISR pro CMS stránky, aby
`/faq` a právní stránky nezmrazily cenu z buildu (#47), unikátní krok
pipeline + migrace `20260916100000_pipeline_step_unique.sql` (#48; **v produkci
zatím neaplikována**, viz NEEDED), uzavření termínu provozovatelem jde přes
plné storno s uvolněním voucheru a upozorněním na vrácení platby (#49),
e-mail „Změna termínu“ s novou `.ics` přílohou po přesunu (#50, nová šablona
v administraci → E-maily), Sentry v prohlížeči jen s DSN (#51), cache
`Intl` formátovačů (#52), realtime klient mimo kritickou cestu kalendáře
(#53), kompaktní payload kalendáře (#54), session jednou za request a profil
bez zbytečného zápisu (#55), middleware bez webhooků a cronů (#56), dávkový
věrnostní stav v administraci (#57), uvolňování expirovaných holdů jen jednou
za minutu (#58), CSP bez `'unsafe-eval'` (#59), pool zámků 5 (#60), Sentry
výjimky se stackem (#61), Prettier (#62), dokumentace (#63). Issue #64 (Nuki
`PUT /auth` nevrací id autorizace) zůstává otevřená do připojení zámku.

Měřený průchod na mobilu (produkční build, lokální Postgres, Lighthouse
mobil se simulovaným pomalým 4G, medián ze 3 běhů):

| Stránka             | před: skóre / LCP / TBT | po: skóre / LCP / TBT  |
| ------------------- | ----------------------- | ---------------------- |
| Domů `/`            | 92 / 2 931 ms / 195 ms  | 92 / 2 942 ms / 162 ms |
| `/rezervace`        | 72 / 4 071 ms / 474 ms  | 92 / 3 232 ms / 104 ms |
| `/rezervace?date=…` | 80 / 4 368 ms / 252 ms  | 91 / 3 260 ms / 142 ms |
| `/rezervace/udaje`  | 84 / 4 037 ms / 195 ms  | 90 / 3 390 ms / 145 ms |

Serverová práce kalendáře `/rezervace`: 300–470 ms → 36–48 ms (cache
`Intl.DateTimeFormat`; `getSlotsForRange` 190 ms → 9 ms). RSC payload
kalendáře 132 kB → 45 kB, HTML 223 kB → 125 kB. Sdílený JS všech stránek
198 kB → 104 kB (Sentry SDK 140 kB gzip mimo první načtení), `/rezervace`
301 kB → 143 kB. Ověřeno: format, lint, typecheck, 132 unit testů, build,
`npm audit --omit=dev` 0 nálezů, 17 veřejných e2e testů (Playwright proti
`next start` a lokálnímu Postgresu), šířky 320–1728 px bez overflow, konzole
bez chyb a CSP violací, klávesnice v mřížce kalendáře s viditelným fokusem.

**Regrese odhalená při ověřování a její oprava.** Po zmenšení payloadu
kalendáře (#54) se v produkčním buildu první výběr dne na `/rezervace`
zhruba v polovině pokusů „neprovedl“: požadavek na RSC odešel a vrátil se,
ale URL ani mřížka se nezměnily, až druhé stisknutí fungovalo. Příčina není
v našem kódu: React (canary přibalený v Next 15.5) při odvíjení pozastavené
navigace uvnitř **existující** Suspense hranice (té z `loading.tsx`) připojí
posluchač na Flight řádek, který mezitím dorazil, a synchronní probuzení
zahodí (`pingSuspendedRoot` běží ještě v render fázi s exit status
„suspended with delay“); následné `markRootSuspended` lane zaparkuje a nic
ji už neprobudí. Menší a rychlejší odpověď trefovala toto okno téměř vždy,
původní 112 kB payload jen náhodou ne. Stejné riziko nese každá stránka,
která naviguje sama na sebe s jinými search params pod `loading.tsx`.
Oprava: `src/app/rezervace/loading.tsx` a
`src/app/account/rezervace/[id]/zmenit/loading.tsx` jsou odstraněné (obě
stránky nesou komentář proč); bez hranice se pozastavení řeší na kořenu,
kde se probuzení zapíše, a přechod jen podrží aktuální pohled, dokud nedorazí
data nového dne (žádné probliknutí skeletonu). Ověřeno 54/54 pokusů
(Enter, mezerník i klik na čerstvé stránce) proti dřívějším ~50 %, navíc
nový e2e test „the first date selection on a fresh calendar always commits“.
Skeleton pro `/rezervace/udaje`, `/rezervace/hotovo` a administrační kalendář
zůstává (ty na sebe s jinými parametry nenavigují). Před přidáním dalšího
`loading.tsx` nad stránku s vlastní navigací přes search params nejdřív
ověřit, že je chyba v Reactu opravená.

---

# Aktualizace 10. 9. 2026 — Comgate a placené rezervace

Rozhodnutí klienta: brána je Comgate. Rezervace vyžaduje platbu; výběr termínu
na měsíc dopředu není neplacená rezervace. Nuki se připojí přibližně za měsíc.

Dodáno: odstranění Stripe SDK/adaptéru/webhooku, Comgate REST 2.0 bez klíčů,
bezpečný návrat hosta, ověřování callbacku přes API, polling watchdogu,
atomická věrnostní odměna, společný DB zámek operací rezervace a perzistentní
intenty plateb/kódů. Neurčitý externí výsledek se neopakuje automaticky.
V Supabase aplikována `comgate_reliability`, DB constraint/rollback testy prošly.
Výchozí `booking.operations`: platby vypnuté, zámek vypnutý, počáteční datum prázdné.
Veřejný CMS FAQ o platbě aktualizován. Staré DB reference ponechány pro audit.

119 unit testů a produkční dependency audit prošly. Statické design review
bez P0/P1, opravené texty CTA a přidané ověření čekající platby. Přihlášené UI,
reálná platba, odemčení a doručování vyžadují řízené E2E s účty/službami.
Aktivace: [COMGATE_SETUP](docs/COMGATE_SETUP.md). Aktuální nálezy:
[produkční review](docs/PRODUCTION_REVIEW_2026-09-10.md) a [NEEDED](NEEDED.md).
Starší části níže popisují historii, včetně již odstraněného poskytovatele plateb.

---

# Předání session

Aktualizováno: 10. 9. 2026

## Stav

**Zákaznický profil a audit (10. 9. 2026).** Účet má profil, historii
objednávek a budoucí rezervace. Ukládá jméno/příjmení, telefon, avatar
Google/iniciály, dobrovolný WhatsApp a umožňuje změnu hesla. E-mailové kódy
jsou povinné i v doručovací pipeline. Změna jména předvyplňuje nové nákupy;
již vystavené doklady se nepřepisují. Aditivní migrace `customer_profile`
je aplikovaná a ověřená v Supabase. Opravené závislosti mají nulový
produkční npm audit; build, typy, lint a 108 unit testů prošly.

**Spuštění zatím není schválené auditem.** Nalezená P1 rizika souběhu
fulfillmentu a věrnostní odměny, obnovy webhooku po pádu procesu a potvrzení
Nuki autorizace jsou v [aktuálním reportu](docs/PRODUCTION_REVIEW_2026-09-10.md).
Chybí ověření produkčních env a placeného průchodu až po fyzické odemčení,
profilových mutací a mobilního vzhledu v přihlášeném prohlížeči.
Podrobnosti starších předání níže jsou historické; při rozporu má přednost
report z 10. 9. 2026.

**Produkční audit administrace (5. 9. 2026).** Prošlo se všech 17
administrátorských obrazovek bez chyb v konzoli. Produkční CMS je doplněný na
122 českých hodnot včetně kontaktu, provozního řádu a všech 12 ilustračních
fotografií. Cena je sjednocená na 289 Kč. Dvanáct plateb visících po
expirovaném checkoutu bylo označeno jako neúspěšné a dvě prošlé slevy byly
deaktivované. Uvolňování expirovaných rezervací nyní aktualizuje i související
platbu. Prázdný ostrý provoz už nikdy nedoplňuje fiktivní členy, rezervace ani
zprávy; výpadek databáze se zobrazí jako chyba s možností opakovat načtení.
Migrace 0011 doplnila všech 15 chybějících indexů cizích klíčů a databázový
Performance Advisor už tento nález nehlásí.

**Bezpečnost demo režimu.** Rezervované demo identity jsou v produkci
odmítnuté při přihlášení i při serverové kontrole oprávnění. Lokální demo
zůstává pro vývoj, je jasně označené a jeho serverové akce nemohou zapisovat.
Před předáním musí provozovatel založit a ověřit skutečný správcovský účet;
po handoffu je třeba demo identity odstranit ze Supabase Auth. Další externí
blokátory a doporučení jsou průběžně vedené v `NEEDED.md`.

**Dokumenty a sestavení.** `iconv-lite` je explicitní produkční závislost,
aby generování faktur/PDF nebylo závislé na náhodném zanoření balíčků. Build,
typová kontrola, lint a unit testy jsou součástí finálního ověření tohoto
release.

**Rebrand na NAVI (4. 9. 2026).** Značka je přejmenovaná všude, kde ji vidí
zákazník: web, metadata, JSON-LD, pět e-mailových šablon, příloha kalendáře,
popis platby ve Stripe, administrace, testy i dokumentace. Uložené texty v
databázi přepíše `npm run rebrand:navi` (nejdřív vypíše, co změní, pak s
`--write`); je idempotentní a nesahá na doménu `namastegym.cz` ani na právní
znění. Starý Instagram přepisuje na `@navi_plzen`. Kontaktní e-mail je nově
`info@navigym.cz`.

**Logo.** `BrandMark`, `BrandLogo` a `BrandLockup` kreslí dodaný znak
(kettlebell s N) jako CSS masku obarvenou `currentColor`: na světlém podkladu
zeleně, na ink zlatě. Dodané logo je zlaté a zlatá na krémovém pozadí má
kontrast ~1,9:1, proto se tam nikdy nepoužívá. **PNG jsou siluety vytažené z
3D vizualizace klienta** (`public/images/navi-logo-source.png`) — tvarem věrné,
ale s měkkými hranami renderu. Až dodá vektory, stačí vyměnit `navi-mark.png`,
`navi-wordmark.png`, `navi-logo.png` a `navi-logo-email.png` a přegenerovat
`src/app/icon.png`; v kódu se nemění nic.

**Ceny.** Standardní cena je 229 Kč (snížena 14. 9. 2026, viz
[docs/LAUNCH_2026_10.md](docs/LAUNCH_2026_10.md)). Akční okno se nastavuje v administraci →
Vstupné a věrnost a řídí se **datem návštěvy**, ne okamžikem nákupu: říjnový
termín stojí akční cenu i při rezervaci v září (rozhodnutí klienta 14. 9. 2026,
viz [docs/LAUNCH_2026_10.md](docs/LAUNCH_2026_10.md)). Věrnostní 10. vstup
zdarma platí i uvnitř akce. Změna termínu cenu nepřepočítává. Texty s cenou používají zástupné `{price}`
a `{pricePerPerson}`, takže nemohou zastarat.

**Rozsah rezervací** už není napevno 60 dní: nastavuje se v administraci →
Nastavení (7–365). Pro říjnovou akci doporučeno 130 dní.

**Administrace.** V Členech lze udělit i odebrat roli správce (posledního
správce systém odebrat nedovolí), v Nastavení přibyly fotografie galerie a zón
se štítkem „Ilustrační foto“ a rozsah rezervací. Měřicí ID GA4 a Meta Pixelu se
berou z env; bez nich se neuloží žádný skript a lišta souhlasu se nezobrazí.

**Drobnosti z klientského e-mailu:** větší text v kalendáři, menší mezera mezi
„Jak to funguje“ a „Ceníkem“, tlačítko v závěrečném pásu na mobilu na střed.

**Přepínač vzhledu** je nově **jen na stránce `/dev`** a nikde jinde se
nevykresluje : v hlavičce ani v mobilním menu, v žádné šířce. Volba zapíše
cookie `ns_design` a vzhled se propíše na celý web; samotné ovládání ale
zůstane na `/dev`. Je to strukturální záruka (hlavička komponentu vůbec
neimportuje, hlídá to unit test), ne CSS pravidlo, které by šlo přebít.

**Doklady o zaplacení.** Po potvrzené platbě se vystaví číslovaný doklad
a odejde e-mailem v PDF. Vystavovatel je předvyplněný podle čl. 1.2 VOP
(Renáta Janoušková, IČO 29619998) : zkontrolovat v administraci → Nastavení
a branding → Fakturační údaje, doplnit DIČ a sazbu, pokud je studio plátcem
DPH, a **zaškrtnout automatické odesílání** (výchozí je vypnuto). Čísla jdou
po sobě v rámci roku (`2026-0001`), na jednu rezervaci nejvýš jeden doklad,
věrnostní vstup zdarma doklad nedostane. Přehled, stažení PDF a „Poslat
znovu“ jsou v administraci → Doklady. Migrace
`drizzle/0010_billing_documents.sql` je v produkčním schématu ověřená.

**Doména.** Web běží na **`https://www.navigym.cz`** (Vercel; `navigym.cz`
přesměrovává 308 na `www`). Přepnuté je DNS, `NEXT_PUBLIC_APP_URL` i Supabase
Auth, takže sitemap, robots i `canonical` uvádějí novou doménu. `namastegym.cz`
zatím servíruje stejný web souběžně, ale posílá `canonical` na novou doménu, což
SEO drží pohromadě, než se z něj udělá 301. Zbývá přepsat **Stripe a Nuki
webhooky** a **referrery klíče Google mapy**; e-maily zatím odcházejí
z `noreply@namastegym.cz`, protože v Resendu je ověřená stará doména.

**Ilustrační fotky** jsou hotové pro všech dvanáct míst a uložené v
`public/images/photos`. Produkční CMS používá stejné cesty a web je značí
malou informační ikonou s vlastním tooltipem.

**Nové v této session (větev `claude/mobbing-feature-ideas-kens00`).** Veřejný
web umí dvě varianty vzhledu: schválenou **Klasickou** a novou **Moderní**.
Přepínač je **skrytý před návštěvníky**: odemkne se až otevřením
`www.navigym.cz/dev`, což nastaví cookie `ns_preview` jen v daném prohlížeči.
Stránka `/dev` je `noindex`, mimo sitemapu i robots. Po odemčení je přepínač
vpravo nahoře v hlavičce (od `xl` výš), na užších displejích v mobilním menu;
na `/dev` jde náhled zase vypnout. Volba se ukládá do cookie `ns_design` a inline skript ji ještě
před vykreslením propíše jako `data-design` na `<html>`, takže se nikdy
neprobliskne druhý vzhled a úvodní stránka si drží ISR. Rozdíly jsou výhradně v
CSS pod `[data-design="modern"]`; klasický vzhled se nezměnil (e2e to ověřuje
přesnými velikostmi 36/48/60 px). Varianta je dočasná pomůcka: po schválení se
Moderní stane výchozí a přepínač se odstraní.

Věrnostní program je vidět všude, kde dává smysl: v potvrzovacím e-mailu přes
novou proměnnou `{loyalty}` (u hostů se prázdný odstavec zkolabuje), na stránce
po rezervaci, ve sloupcích „Návštěvy“ a „Do zdarma“ v administraci → Členové a
v účtu jako segmentový pás (Klasický) nebo zlatý prstenec (Moderní).

Rezervaci lze přidat do kalendáře: `.ics` z autorizované route
`/api/reservations/[id]/calendar.ics`, odkaz na Google Kalendář a stejná příloha
v potvrzovacím e-mailu. Do kalendáře se nikdy nedostane vstupní kód.

Administrace má místo obecného „Přehledu“ provozní stránku **Dnes**: dnešní
program se stavy, dnešní tržba (počítá jen skutečně zaplacené vstupy), dnešní
odemčení ze zámku, sedmidenní trend a feed toho, co vyžaduje pozornost.

Klientská revize veřejného webu je implementovaná a připravená k prezentaci.
Veřejný header používá přesné dodané logo v horizontálním uspořádání: lotus
vlevo a wordmark `NAVI Private Gym` vpravo. Vertikální varianta zůstává na
přihlášení a v patičce.

Úvodní stránka odpovídá klientským poznámkám: širší navigace ve verzálkách,
zlaté „NAVI.“ v hero, Plzeň - Roudná, otevírací doba 5:00–23:45,
informační pás v prvním viewportu, vycentrované časy, každý 10. vstup zdarma,
stejně velké kroky 01–06 a bílá cenová karta. Hero adresa a otevírací doba jsou
vedle sebe se zarovnanými CTA pod nimi. Informační pás začíná
„Samoobslužné fitness“ a karta dostupnosti výslovně uvádí cenu za 75 minut.
Kontaktní údaje se neopakují před mapou: adresa a otevírací doba zůstávají jen
v mapové kartě, telefon a e-mail v patičce.
Šest provozních kroků používá zlaté štítky 01–06 přímo před nadpisy. Nadpisy
mají v každém řádku společnou výšku a navazující text začíná pod nimi ve stejné
úrovni. Všechny podpůrné lotusové motivy používají oficiální klientskou
pětilistou značku; ve FAQ se lotos při otevření plynule změní na otazník.
Favicon v `src/app/icon.png` používá stejný přesný klientský lotus ve zlaté
barvě na tmavě zeleném podkladu. Starý ručně kreslený SVG favicon byl odstraněn.
Mapa se načítá vycentrovaná pomocí souřadnic a vlastní přední karta NAVI zůstává
nad ní. Dokud není ve Vercelu platný Google API klíč i Map ID, používá se bez
chyb standardní embed; vlastní lotusový marker se zapne až s oběma hodnotami.
Závěrečný zelený CTA pás je vlevo zarovnaný s okolním obsahem; na desktopu
navazuje větší tlačítko Rezervovat, na mobilu se prvky řadí pod sebe vlevo.
Pod nadpisem je zlatou linkou oddělený editovatelný citát.
Cenová karta má label „Jednorázový vstup“, cenu ve zlaté brandové barvě, délku
vstupu a rezervační tlačítko. Nemá text „Celý gym jen pro vás“, opakovaný
věrnostní text ani poznámku o registračních poplatcích.
V desktopovém hero je rezervační kalendář svisle vycentrovaný vůči celému
hero layoutu.
Resend doména `namastegym.cz` je ověřená a Vercel má nastavený serverový
sender `NAVI Private Gym <noreply@namastegym.cz>`. Administrace →
**E-maily** obsahuje pět editovatelných českých šablon: potvrzení registrace,
obnovu hesla, potvrzení rezervace, vstupní kód a storno. Všechny mají stejné
logo, náhled, proměnné a testovací odeslání na zadanou adresu. Potvrzení
rezervace se odesílá po potvrzené platbě, vstupní kód a storno používají stejný
systém šablon.

Přibyly `/forgot-password` a `/reset-password`. Obnova hesla už volá Supabase
Auth s rate-limitem a odpovědí, která neprozradí existenci účtu. Custom SMTP
přes Resend je nastavený a resetovací tok na vlastní doméně byl ověřený. Aby
administrace mohla propsat šablony registrace a resetu přímo do Supabase Auth,
ještě doplnit ve Vercelu serverový `SUPABASE_MANAGEMENT_API_TOKEN`. Přesný
postup je v §7
[MANUAL_STEPS.md](./MANUAL_STEPS.md#7-supabase-auth-smtp-a-šablony-z-administrace).

Administrace už neobsahuje položku ani route „Plán spuštění“. `/admin/content`
je přepsaný na klientsky bezpečný editor: aktuální texty jsou rozdělené na
Hero, informační lištu, průběh rezervace, ceník, galerii, Vybavení, FAQ, mapu a
kontakt a provozní řád. Jedinou editovatelnou hodnotou je text po kliknutí na
ikonu tužky; klíč, typ a interní skupina se nikde nezobrazují. Texty z FAQ a
Vybavení jsou nyní také čtené z CMS, nikoli z lokálních konstant.
Kořenový layout je výškový flex sloupec a přímý `main` vyplňuje volné místo.
Footer proto končí u spodního okraje viewportu na krátkých veřejných stránkách
a za obsahem na stránkách delších.

`/faq` obsahuje všech dvacet klientem dodaných otázek a odpovědí a stránka
generuje `FAQPage` strukturovaná data. FAQ i Vybavení jsou editovatelné přes
zjednodušený editor obsahu.

## Potvrzené podklady

- adresa: `Křížkova 424/23, Plzeň - Roudná`;
- otevírací doba: každý den 5:00–23:45;
- slot: 75 minut;
- kapacita: až 5 osob včetně dětí;
- cena: 229 Kč za rezervaci (od 14. 9. 2026; v říjnu 2026 akčních 199 Kč),
  každý 10. vstup zdarma;
- Instagram: `@navi_plzen`;
- logo: zdroj od klienta, odvozené transparentní soubory jsou v
  `public/images/navi-logo.png`, `navi-mark.png` a `navi-wordmark.png`.

Nepoužívat telefon, e-mail ani další kontakty z Wix šablony. Produkční CMS
obsahuje potvrzený e-mail `info@navigym.cz`, telefon, adresu a aktuální odkazy
na Instagram a Facebook.

## Demo

Lokální demo vyžaduje `DEMO_AUTH_ENABLED=true`,
`DEMO_AUTH_SECRET` dlouhý alespoň 32 znaků a volitelně
`BOOKING_PREVIEW_FIXTURE=true`.

Přihlašovací stránka demo údaje nezobrazuje. Demo režim se v produkci
automaticky vypne a rezervované demo identity jsou odmítnuté i na serveru.

## Poslední ověření

Vše běželo na Node 22:

- `npm run format:check`: prošlo;
- `npm run lint`: prošlo;
- `npm run typecheck`: prošlo;
- `npm test`: 95 passed;
- lokální admin Playwright: přihlášení, mobilní menu a všech 17
  administrátorských rout prošlo bez browser exception nebo error boundary;
- produkční veřejný smoke test bez databáze: 8 passed, 1 očekávaně skipped;
- produkční skip-link stress test: 5/5 passed;
- `npm run build`: prošlo bez `DATABASE_URL`, nedostupná DB správně přepne web
  na bezpečný fallback;
- `npm audit --omit=dev`: 2 moderate nálezy v PostCSS přes Next.js;
- plný `npm audit`: 6 moderate, 0 high a 0 critical. Dostupná automatická
  oprava přechází na Next.js 16.3.4, proto nebyl bez samostatného regresního
  auditu použit `npm audit fix --force`.

Vizuálně byly ověřeny desktop 1440 × 900 a mobil 390 × 844. Responzivní měření
proběhlo od 320 do 1728 px bez horizontálního overflow. Mobilní menu, login,
FAQ accordion, focus, Escape a reduced motion mají regresní pokrytí.

## Co zbývá

Úkoly vyžadující klienta nebo externí služby jsou v
[NEEDED.md](./NEEDED.md). Nejdůležitější jsou:

1. skutečný správcovský účet a odstranění produkčních demo identit;
2. právní potvrzení VOP a provozního řádu;
3. ověření schránky `info@navigym.cz`, domény v Resendu a ostrého e-mailového
   workflow;
4. oprava Google Maps klíče, zapnutí GA4/Meta a přepnutí webhooků Stripe/Nuki;
5. kontrola fakturačních údajů a ostrý test platby, dokladu i kalendářové
   přílohy;
6. potvrzení zbývajícího aktivního voucheru, ochrana proti uniklým heslům a
   srovnání historie migrací 0006–0010.

Desktopové i mobilní veřejné menu je ve verzálkách; desktopové položky jsou
roztažené přes samostatný široký středový prostor headeru.

## Orientace v repozitáři

- aktuální stav produktu: [README.md](./README.md);
- externí kroky: [NEEDED.md](./NEEDED.md) a
  [MANUAL_STEPS.md](./MANUAL_STEPS.md);
- vizuální pravidla: [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md);
- poslední audit: [docs/UX_AUDIT.md](./docs/UX_AUDIT.md);
- E2E režimy: [tests/e2e/README.md](./tests/e2e/README.md).
