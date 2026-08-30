# Plán: schválené funkce a varianta „Moderní“

Aktualizováno: 30. 8. 2026. Navazuje na [FEATURE_IDEAS.md](./FEATURE_IDEAS.md).
Slouží jako podklad pro GitHub issues; implementace proběhne po odsouhlasení.

## Schválený rozsah

- **Ano:** věrnostní progres (A), potvrzení rezervace s „Přidat do kalendáře“
  (B), administrace „Dnes“ (C), balíček moderního designu (D) a přepínač
  vzhledu Klasický/Moderní vpravo nahoře (0).
- **Ne (rozhodnutí klienta):** online prodej dárkových poukazů, hlídání
  termínu (waitlist) a pozvánky hostů ke sdílení rezervace.

## Zjištěný stav (korekce oproti rešerši)

- Věrnostní logika už existuje: `src/lib/services/loyalty.ts`
  (`deriveLoyaltyStatus`, `priceForNextEntry`) a `LoyaltyWidget` je hlavním
  prvkem `/account` (ink karta se zlatými segmenty). Úkol A je „dokončit a
  povýšit“, ne stavět od nuly.
- `/admin` už má stránku Přehled (tři `StatCard` + poslední rezervace).
  Úkol C je přestavba této stránky, ne nový modul.
- Úvodní stránka má ISR (`revalidate = 60`). Přepínač vzhledu proto nesmí
  číst cookie na serveru veřejných stránek, jinak je zdynamizuje.
- E-maily jsou textové šablony s `{proměnnými}` v
  `src/lib/config/email-templates.ts`; Resend adaptér zatím neumí přílohy.
- `reservation.priceCents` existuje (`null` = kryto členstvím, `0` = věrnostní
  vstup zdarma), takže dnešní tržba jde spočítat bez změny schématu.

## 0. Přepínač vzhledu Klasický/Moderní (infrastruktura)

- Cookie `ns_design=classic|modern`, platnost 1 rok, `SameSite=Lax`, bez
  `HttpOnly` (čte ji klientský skript). Bez cookie platí `classic`.
- Inline skript (`beforeInteractive`) v root layoutu nastaví
  `data-design` na `<html>` z cookie ještě před vykreslením: žádný záblesk
  a HTML zůstává variantně neutrální, takže ISR veřejných stránek přežije.
- Vizuální rozdíly řeší CSS přes `[data-design="modern"]` (tokeny + omezené
  strukturní úpravy). Drobné blokové rozdíly (např. prstenec vs. segmenty)
  mají obě podoby v DOM a přepíná je CSS; velké větvení DOM je zakázané,
  spadne vždy do tokenů.
- Dynamické stránky (`/account`, admin) smí číst cookie serverově helperem
  `getDesignVariant()`; už dynamické jsou.
- `DesignVariantSwitch`: přístupný dvoustavový přepínač „Klasický | Moderní“
  v pravém klastru `SiteHeader` (radiogroup, cíle 44 px, viditelný focus).
  Pod `sm` se kvůli těsné hlavičce přesouvá do mobilního menu. Zapíše cookie
  a `dataset.design` okamžitě, bez reloadu.
- Administrace přepínač nemá; jede v jednom vzhledu.
- Governance: mechanismus a tokeny se zdokumentují v `docs/DESIGN_SYSTEM.md`
  a v `/admin/design-system` (nová sekce „Designové varianty“).
- Životní cyklus: dočasný náhledový nástroj pro srovnání s klientem. Po
  schválení se Moderní stane defaultem a přepínač se odstraní.

## A. Věrnostní progres: dokončení

1. **E-mail:** proměnná `{loyalty}` v šabloně `reservation_confirmation`.
   Člen: „Tohle byla vaše 7. návštěva, do vstupu zdarma zbývají 3.“ /
   „Příští vstup máte zdarma.“ Host: prázdná hodnota; renderer po dosazení
   zkolabuje vzniklé dvojité prázdné řádky. Výpočet v
   `services/notifications.ts` při odeslání potvrzení; počítá se stav po
   započtení právě potvrzené rezervace. Výchozí text šablony v
   `src/lib/config/email-templates.ts` se rozšíří a administrace → E-maily
   proměnnou automaticky nabídne.
2. **`/rezervace/hotovo`:** přihlášenému členovi s potvrzenou rezervací se
   pod tělem stavu zobrazí věrnostní řádek (reuse `getLoyaltyStatus`);
   host nevidí nic.
3. **Admin Členové:** sloupce „Návštěvy“ a „Do zdarma“ jedním group-by
   dotazem v `services/members.ts` (žádné N+1); detail člena ukáže mini
   přehled (celkem, získané vstupy zdarma).
4. **Moderní podoba widgetu:** ve variantě Moderní zlatý SVG prstenec
   s „7/10“ (inspirace Ladder/Oura), klasika ponechá segmentovou lištu.
   `aria-label` nese přesný stav; `prefers-reduced-motion` vypne nájezd.

Testy: unit `deriveLoyaltyStatus` (0, 9, 10, 19), render obou podob widgetu,
e2e účtu, náhled e-mailu s `{loyalty}`.

## B. Přidat do kalendáře

1. `booking.getBookingConfirmation` vrátí i `startsAt`/`endsAt`.
2. Route handler `GET /api/reservations/[id]/calendar.ics`: autorizace
   shodná s hotovo stránkou — vlastnictví přihlášeným uživatelem, nebo
   platné `session_id` (neuhodnutelné Stripe checkout id) v query; jinak 404. VEVENT v `Europe/Prague`: UID `<id>@namastegym.cz`, SUMMARY
   „Trénink · NAMASTÉ Private Gym“, LOCATION veřejná adresa z CMS,
   DESCRIPTION krátké pokyny. Vstupní kódy do kalendáře nikdy nepatří.
3. UI: na `/rezervace/hotovo` (jen stav confirmed) akce „Přidat do
   kalendáře (.ics)“ a odkaz „Google Kalendář“
   (`calendar.google.com/render?action=TEMPLATE`, časy v UTC). Stejné akce
   u nadcházejících rezervací v `/account`.
4. E-mail: příloha `rezervace.ics` v potvrzení. Resend adaptér se rozšíří o
   volitelné `attachments` (base64) a `sendTransactionalEmail` o
   passthrough. Fallback při potížích: odkaz na ICS route v textu.

Testy: unit ICS builderu včetně přechodů letního času, e2e stažení z hotovo
stránky, kontrola, že `.ics` neobsahuje kód ani PII navíc.

## C. Administrace „Dnes“

Přestavba `/admin/page.tsx` (vzory Fresha, Jobber, Cal.com Insights):

- Titulek s dnešním datem a pozdravem (např. „Sobota 30. 8.“).
- Dlaždice: Dnešní rezervace (počet + nejbližší začátek), Dnešní tržba
  (součet `priceCents` u confirmed/completed dnes; `0`/`null` se nepočítá a
  popisek to říká), Neuzavřená upozornění, Nedoručené zprávy.
- „Dnešní program“: chronologický seznam dnešních rezervací se stavovými
  odznaky, zvýrazněním právě probíhající a značkou „zdarma (věrnost)“ u
  `priceCents = 0`.
- „Dnešní vstupy“: dnešní záznamy z entry-logu. Log nezná odchody, takže
  žádné tvrzení „kdo je právě uvnitř“; jen fakta o vstupech.
- Mini KPI: rezervace za 7 dní vs. předchozích 7, storna, no-show (reuse
  `services/stats.ts`) + odkaz na Statistiky.
- Aktivita: sloučený feed posledních alertů, selhaných zpráv a nových
  rezervací, řazený časem.
- Vše `Promise.all` s `.catch` fallbackem a demo režimem jako dnes. Nové
  čtení dat jako `stats.getDayOverview(date)` nebo
  `reservations.listForDay(date)`; beze změny schématu.

## D. Balíček „Moderní“ designu

Vodítka z rešerše: Open (editorial dark), Oura (zlato na tmavé), Cal.com
(klidné plochy), Fresha (stavové čipy). Vše v mezích design systému: žádné
gradienty, glow ani glass; ink veil je sankcionovaný vzor. Každý bod se
dokumentuje v `docs/DESIGN_SYSTEM.md` + `/admin/design-system` jako součást
sekce „Varianta Moderní“.

1. **Typografická eskalace:** H1 v Moderní až 72 px (klasika drží 36–60),
   section spacing na desktopu 96 → 120 px, výraznější uppercase eyebrows
   se zlatou linkou. Vyžaduje dokumentovaný dodatek škály pro variantu.
2. **Hero kompozice:** headline níž a doleva, fakta a CTA srovnané na
   společnou účaří; pravidla ink veilu beze změny; jen ověřené fotografie.
3. **Fact strip jako „fitness čísla“:** větší extrabold číslovky
   (75′ · 5 osob · 290 Kč · 5:00–23:45) se zlatým akcentem, hairlines
   zůstávají.
4. **Zóny na `/vybaveni`:** dlaždice s fotkou pod `ink/78` veilem a zlatým
   uppercase titulkem (vzor Open); do dodání fotek zón zůstává brand výplň.
5. **Mikrointerakce:** 140 ms `ease-brand` hover (podtržení odkazů, posun
   šipky CTA o 2 px), bezpečné pro reduced motion.
6. **Hlavička při scrollu:** v Moderní kondenzovaná výška a výraznější
   spodní linka.
7. **Věrnostní prstenec** (bod A4) jako vlajkový moderní prvek účtu.
8. **Admin:** bez varianty, ale „Dnes“ přebírá stavové čipy a klidnější
   tabulky v rámci stávajících admin komponent.

## GitHub issues (založeno 30. 8. 2026)

| Issue                                                       | Obsah                                                           | Závisí na | Odhad |
| ----------------------------------------------------------- | --------------------------------------------------------------- | --------- | ----- |
| [#26](https://github.com/lukaskourilcz/gym-plzen/issues/26) | Infrastruktura přepínače vzhledu (0) + dokumentace + e2e        | —         | S/M   |
| [#27](https://github.com/lukaskourilcz/gym-plzen/issues/27) | Věrnost: e-mail `{loyalty}`, hotovo řádek, admin sloupce (A1–3) | —         | M     |
| [#28](https://github.com/lukaskourilcz/gym-plzen/issues/28) | Přidat do kalendáře: ICS route, UI, příloha e-mailu (B)         | —         | M     |
| [#29](https://github.com/lukaskourilcz/gym-plzen/issues/29) | Administrace „Dnes“ (C)                                         | —         | M/L   |
| [#30](https://github.com/lukaskourilcz/gym-plzen/issues/30) | Moderní balíček veřejného webu (D1–D6)                          | #26       | L     |
| [#31](https://github.com/lukaskourilcz/gym-plzen/issues/31) | Věrnostní prstenec v Moderní (A4/D7)                            | #26       | S     |
| [#32](https://github.com/lukaskourilcz/gym-plzen/issues/32) | Průřezová verifikace obou variant + aktualizace dokumentace     | #26–#31   | M     |

Issue [#32](https://github.com/lukaskourilcz/gym-plzen/issues/32) = Playwright
přes obě varianty (320–1728 px, klávesnice, reduced motion), axe AA,
design-system reviewer, aktualizace `SESSION_HANDOFF.md`. Každé issue nese
soubory, akceptační kritéria a checklist ověření (`format:check`, `lint`,
`typecheck`, `test`, `build` + pravidla `.claude/rules/design-system.md`).

## Rizika a mantinely

- **ISR:** přepínač nesmí zdynamizovat veřejné stránky; ověří se, že
  úvodní stránka zůstává ISR i s přepínačem.
- **Duální DOM** jen pro drobné bloky; cokoli většího řeší tokeny.
- **Žádné vymýšlení faktů:** žádné nové fotografie, recenze ani sliby;
  veškerá zákaznická copy česky.
- **Kalendář bez tajemství:** vstupní kódy se do `.ics` nikdy nedostanou.
- **Přílohy e-mailů:** malé KB soubory; při potížích fallback odkazem.
- **Dočasnost přepínače:** po schválení Moderní se stane defaultem a
  přepínač se odstraní (jednořádková změna defaultu).
