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

Ověřeno: 149 unit, 14 integračních testů, lokální demo administrace v
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
e-mail i účet slibují „osobní vstupní kód před začátkem rezervace“ — do
připojení zámku ho musí zákazníkům poslat provozovatel ručně, nebo upravit
šablonu v administraci → E-maily (viz NEEDED).

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
