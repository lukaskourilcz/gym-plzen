# Session handoff

Poslední aktualizace: 2026-07-22

Tento checkpoint vznikl na výslovnou žádost uživatele před restartem CLI. Kód
je zacommitovaný jako rozpracovaný, ale kompilovatelný první průchod. Původní
zadání požaduje ještě nezávislý UX audit, opravy podle auditu, finální UX pass a
kompletní závěrečné QA. Tyto fáze zatím neproběhly a další agent v nich má
pokračovat.

## Co je hotové

- Canonical design system v `docs/DESIGN_SYSTEM.md`, semantic CSS tokens,
  sdílené UI primitives a chráněná galerie `/admin/design-system`.
- Veřejný web NAMASTÉ s lotus symbolem v headeru, plným logem ve footeru,
  upraveným hero, cenou, platbami, pravidly, galerií, kontaktem a full-width mapou.
- Routes `/faq`, `/vybaveni`, `/obchodni-podminky`, `/ochrana-soukromi`, sitemap,
  robots, loading a not-found.
- CMS pole pro hero URL a alt text. Aktuální fallback používá fotografii z webu
  klienta, ne generovaný obrázek.
- `/rezervace` používá Monday-first měsíční date-first kalendář, URL stav
  `month/date`, přesné rozsahy slotů, trvání a cenu.
- Server znovu řeší autoritativní slot, cenu, trvání, horizont a overlap.
- `Europe/Prague` helpers a DST testy.
- Bezpečný preview fixture pouze mimo produkci. Produkce bez DB zobrazuje
  nedostupnou službu.
- Lokální demo admin a klientský účet používají podepsané HttpOnly cookies a v
  produkci jsou vynuceně vypnuté.
- Přesměrování po loginu a OAuth je omezené na interní cesty.
- Stripe pending expirace, idempotentní webhook claim, serverové ověření success
  stránky a bezpečnější fulfillment retry.
- Veřejný Realtime je přesměrovaný na PII-free `availability_signal`.
- CMS upload kontroluje skutečný typ, signaturu, rozměry, velikost a bezpečný název.
- Security headers a CSP jsou v `next.config.ts`.
- Závislosti byly aktualizované. Produkční dependency audit má 0 nálezů.
- Node 22 produkční build prošel.

## Neaplikovaná databázová migrace

`drizzle/0003_security_and_realtime.sql` je připravená, ale není aplikovaná.
Supabase MCP je aktuálně nastavený na `rkmunagymohxtclymacm`; při kontrole jeho
schéma neodpovídalo gym aplikaci. Neprováděj remote SQL, dokud uživatel nepotvrdí
správný projekt. Podrobnosti jsou v `NEEDED.md`.

## Poslední ověření

Prošlo:

```text
npm run typecheck
npm run lint
npm test                         14/14 unit testů
npx -y -p node@22 -c 'npm run build'
npm audit --audit-level=high     exit 0, 4 moderate pouze v dev Drizzle toolchain
npm audit --omit=dev             0 vulnerabilities
```

Playwright:

- Lokální veřejný rezervační test jednou prošel včetně volby data a exact time
  range.
- Následný celý veřejný běh narazil na timeout vývojového serveru spuštěného pod
  nepodporovaným Node 20. Server se při on-demand kompilaci zasekl a byl ukončen.
- Produkční E2E na Node 22 ještě spusť znovu podle `tests/e2e/README.md`.
- Plná auth/admin E2E čeká na potvrzený samostatný Supabase test projekt.

Vizuálně bylo ověřeno:

- homepage na 320, 390 a 1440 px bez horizontálního overflow;
- rezervační kalendář na 320 px, exact time ranges a popsané preview;
- admin demo na mobilu a desktopu;
- klientský account, věrnost a logout;
- semantic DOM kalendáře a přesun fokusu šipkami.

## Známé technické poznámky

1. `src/lib/helpers/logger.ts` rediguje PII. Telefonní regex je nyní příliš
   široký a v build logu redigoval části ISO timestampů jako telefon. Oprav regex
   tak, aby nezhoršil redakci skutečných čísel, a doplň unit testy.
2. Vestavěný browser driver přesunul fokus v kalendáři, ale jeho syntetické
   Enter/click neprovedlo Next navigaci. Samostatný Playwright kliknutí provedl.
   Nově je v handleru explicitní Enter i Space. Ověř to znovu v produkčním E2E.
3. `tests/e2e/public.spec.ts` byl rozšířen o keyboard, breakpoint a reduced-motion
   testy po posledním plném běhu. Spusť celou specifikaci proti Node 22 serveru.
4. `npm run format:check` spusť po tomto dokumentačním checkpointu.
5. CSP používá `unsafe-inline`, protože současný Next hydration setup nemá nonce.
   Je to residual risk, ne tvrzená nonce CSP.
6. 4 moderate audit findings jsou pouze v Drizzle Kit přes legacy
   `@esbuild-kit/esbuild`. `npm audit fix --force` by provedl breaking downgrade,
   proto nebyl použit.

## Povinné pokračování podle původního zadání

1. Spusť format check, lint, typecheck, unit testy a produkční veřejné E2E.
2. Oprav logger regex a každý nový nález.
3. Spusť aplikaci pod Node 22 a dokonči manuální QA na 320, 390, landscape, 768,
   1024, 1280, 1440 a wide desktop, keyboard-only, reduced motion a 200% zoom.
4. Ověř homepage, rezervace, login, klientský účet, FAQ, Vybavení, legal routes,
   admin a design kit. Kontroluj konzoli, hydration a overflow.
5. Commitni validovaný první pass, pokud tento checkpoint bude po další úpravě
   rozdělený do menších logických commitů.
6. Až potom spusť jednoho samostatného senior UX review agenta. Nesmí měnit
   aplikační kód. Musí napsat česky `docs/UX_AUDIT.md` podle původního zadání.
7. Ověř jeho findings, oprav všechny oprávněné P0/P1 a rozumné P2, přidej testy
   a commitni remediation.
8. Vrať stejnému reviewerovi aplikaci k finálnímu passu a nech aktualizovat
   `docs/UX_AUDIT.md` o resolved, unresolved a externally blocked stav.
9. Spusť závěrečný build, E2E, audit a vizuální QA.
10. Nepushuj bez nového výslovného souhlasu uživatele.

## Obsah, který se nesmí domyslet

- e-mail a telefon klienta;
- skutečný seznam vybavení;
- otevírací doba, storno, hosté, děti a kapacita;
- právní identita provozovatele;
- finální fotografie a schválené logo;
- produkční dostupnost, recenze, certifikace nebo garance.

## Git

- Výchozí commit před touto prací: `ec0f9ac`.
- Design-system checkpoint: `ffdbabe docs(design): establish NAMASTE design system`.
- Aktuální checkpoint má obsahovat všechny rozpracované změny a tuto dokumentaci.
- V této session se nemá pushovat.
