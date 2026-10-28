# Audit celé aplikace — 28. října 2026

Issue #282. Výchozí commit: `f9b35c4c3ba3b485e413ba96fd5f992325111a5e`
(samostatně schválené a sloučené PR #281). Audit a jeho opravy zůstávají na větvi
`codex/application-audit-2026-10-28`; nejsou schválené pro merge ani nasazení.
Automatické Vercel preview této větve je vypnuté. Testy používají výhradně
oddělené místní databáze a náhrady poskytovatelů s blokováním vnější sítě.

## Mapa pokrytí

Inventář a předchozí audit nejsou důkazem nové kontroly. Stav se doplňuje až
po přečtení celých kritických toků, ověření jejich volajících a konkrétních testů.

| Oblast                          | Vstupy a související moduly                                                                | Stav a důkaz     |
| ------------------------------- | ------------------------------------------------------------------------------------------ | ---------------- |
| Identita, role a profil         | auth guards/demo, Supabase middleware/callbacky, customer-profile/password, členové        | Rozpracováno     |
| Rezervace a kapacita            | booking/orders/reservations, availability/schedule/slots, blokace a uzávěry                | Čeká na kontrolu |
| Změny a storna                  | rescheduling/priced-rescheduling, finance-guard, původní přístup, kompenzace               | Čeká na kontrolu |
| Peníze a kredity                | payments/order-state, credit ledger/holds/admin/change-state, vouchers/loyalty/memberships | Čeká na kontrolu |
| Kódy a integrace zámku          | access-codes, Nuki, lock-health, entry-log, recovery                                       | Čeká na kontrolu |
| Komunikace a dokumenty          | fulfillment/pipeline/messages, e-mail/SMS/WhatsApp, invoice/archive/delivery               | Čeká na kontrolu |
| Vnější vstupy a plánované úlohy | všechny API routes, webhooky, OAuth, cron a omezené retry fronty                           | Čeká na kontrolu |
| Web, obsah a média              | veřejné stránky, dostupnost, CMS, upload, Instagram, newsletter, právní dokumenty          | Rozpracováno     |
| Administrace a náhledy          | všechny admin actions, seznamy/filtry, finanční přehledy, simulace zákazníka               | Čeká na kontrolu |
| Databáze a migrace              | schéma, constraints/FK/indexy, RLS/GRANTs, migrační historie, souběh/DST                   | Čeká na kontrolu |
| Výkon a dostupnost              | plány dotazů a počty čtení, cache/realtime, timeouty, payloady a klientské hranice         | Čeká na měření   |
| Závislosti a provoz             | advisories/lockfile, prostředí, build/CI, monitoring, release a rollback                   | Rozpracováno     |

## Výchozí ověření

PR #281 před sloučením: oba GitHub Actions běhy úspěšné, 335 jednotkových,
281 integračních a 168 prohlížečových testů; SQL oprávnění/neměnnost historie,
build, typy, lint a formátování prošly. Čtyři nízké npm advisories z řetězce
Resend/deepmerge jsou známý podnět pro tento audit, nikoli výjimka z CI prahů.

## Nálezy, opravy a měření

Doplní se pouze reprodukované nálezy, jejich dopad a regresní důkazy. Zelená
sada testů neznamená záruku absence všech chyb ani externí penetrační test.

### A01 — Nepoužívaný SDK přinášel zranitelný řetězec závislostí (P3)

`resend` SDK není importován v aplikaci ani testech. Doručování používá vlastní
časově omezený HTTP transport `resend-transport.ts`, včetně idempotency klíčů a
klasifikace neznámé odpovědi. Odstranění nepoužívaného balíčku eliminuje SDK i
jeho tranzitivní React renderer/html-to-text/deepmerge a čtyři advisories
[GHSA-gcqx-w48m-w2h4](https://github.com/advisories/GHSA-gcqx-w48m-w2h4).
Audit lockfile po odstranění: **0 zranitelností**, bez vypnutí bezpečnostních
kontrol nebo změny transportu/zpráv. Prokázaný nález je zranitelná závislost;
zneužitelná cesta přes skutečné doručování v této aplikaci nebyla prokázána.

### Samostatně dokončený release PR #281

Produkční Vercel deployment `dpl_2vmZL4ojDyCZV1avakfwi2M9PY5w` je READY,
main commit `f9b35c4c3ba3b485e413ba96fd5f992325111a5e`, region `cdg1`, doména
`www.navigym.cz`. Žádná migrace ani auditní oprava se do tohoto release nepřidala.
Následné ověření používá pouze veřejné GET pro úvodní stránku, dostupnost a
podmínky; žádné potvrzovací/platební URL, cron, zásah do zámku nebo testovací nákup.
