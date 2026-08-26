# Co je potřeba dokončit mimo repozitář

Externí a klientské kroky. Manuální detaily viz [MANUAL_STEPS.md](./MANUAL_STEPS.md).

## Přehled úkolů

`[imp:N]` = priorita 1–5, `[owner:me]` = externí krok, `[owner:ai]` = úkol pro
AI po dodání podkladů. `[kind:K]` ∈ `setup` `deploy` `legal` `content` `decision`.

- [ ] **Odstranit demo identity z produkčního Supabase** — v Auth i `profiles` smazat účty `admin@namaste.demo` a `klient@namaste.demo`, pokud existují. Aplikace je po auditu mimo podepsaný lokální demo režim odmítá, ale produkční sdílené účty nesmí zůstat aktivní. `[imp:5]` `[owner:me]` `[time:10m]` `[kind:setup]`
- [ ] **Schválit a sjednotit právní texty** — klientka nebo právník musí potvrdit kapacitu (VOP 4, FAQ 5, Provozní řád 6 osob), první telefon (`…557` vs. `…355`), storno vs. změnu termínu, umístění lékárničky a zda se mají opravit původní překlepy a sledovací parametr v odkazu ČOI. Do potvrzení se dodané VOP nemění. `[imp:5]` `[owner:me]` `[time:45m]` `[kind:legal]`
- [ ] **Schválit privacy provozní údaje** — potvrdit dohodu společných správců dle čl. 26 GDPR, dobu uchování kamerových záznamů, správce kamer, GA4 retention, skutečně aktivní Sentry/GoSMS a zda Google Maps načítat až po kliknutí. `[imp:5]` `[owner:me]` `[time:45m]` `[kind:legal]`
- [ ] **Aplikovat a ověřit všechny migrace** — v každém cílovém prostředí spustit sled `0000` až `0009` na čisté/testovací databázi a poté `npm run db:migrate`; zvlášť ověřit RLS, no-overlap constraint, consent sloupce, rescheduling, vouchery a newsletter. `[imp:5]` `[owner:me]` `[time:30m]` `[kind:deploy]`
- [ ] **Povolit synchronizaci Auth e-mailů z administrace** — vytvořit Supabase Personal Access Token, uložit ho jako `SUPABASE_MANAGEMENT_API_TOKEN` pro Production a Preview a nasadit. Postup je v [MANUAL_STEPS.md §7](./MANUAL_STEPS.md#7-supabase-auth-smtp-a-šablony-z-administrace). `[imp:5]` `[owner:me]` `[time:10m]` `[kind:setup]`
- [ ] **Ostrý test e-mailového workflow** — nová registrace, reset hesla a test všech pěti šablon; v Resend Logs ověřit doručení, český text, logo a sender. `[imp:5]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Nahradit zástupný kontaktní e-mail** — v administraci → Obsah webu změnit `contact.email` z `info@namastegym.cz` na potvrzenou adresu a promítnout ji i do schválených právních dokumentů. `[imp:5]` `[owner:me]` `[time:10m]` `[kind:content]`
- [ ] **Nahradit neplatný klíč Google mapy** — vytvořit platný Maps JavaScript API key s billingem a HTTP referrery pro obě varianty domény, uložit `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` a znovu nasadit. Do té doby funguje bezpečný embed fallback. `[imp:4]` `[owner:me]` `[time:15m]` `[kind:setup]`
- [ ] **Zaregistrovat Stripe webhook** — pro test i live nastavit `/api/webhooks/stripe`, vybrat čtyři Checkout události z runbooku a uložit odpovídající `STRIPE_WEBHOOK_SECRET`. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Fyzicky ověřit Nuki** — po nákupu doplnit Smart Lock ID a webhook secret; ověřit vytvoření, potvrzení v API, otevření, expiraci a revokaci PINu i retry po simulovaném selhání. `[imp:4]` `[owner:me]` `[time:2h]` `[kind:setup]`
- [ ] **Dokončit WhatsApp provisioning** — propojit Meta/WABA přes Zernio, verifikovat číslo a schválit šablonu `access_code`; pak rozhodnout, zda ponechat přímý Meta adapter, nebo schválit jeho přepis na Zernio. `[imp:4]` `[owner:me]` `[time:1h]` `[kind:decision]`
- [ ] **Ostrý host checkout** — zaplatit rezervaci bez registrace a ověřit Stripe webhook, potvrzení, e-mail/telefon, administraci, expiraci opuštěného Checkoutu a nemožnost potvrdit nesprávnou částku či měnu. `[imp:4]` `[owner:me]` `[time:45m]` `[kind:setup]`
- [ ] **Přihlášení přes Google v Safari** — sjednotit `NEXT_PUBLIC_APP_URL`, Supabase Site URL a Redirect URLs pro `www` i holou doménu; potom znovu projít PKCE redirect v Safari. `[imp:4]` `[owner:me]` `[time:20m]` `[kind:setup]`
- [ ] **Fotografie jednotlivých zón** — dodat snímky pro silovou, kardio a strečink zónu, dětský koutek, lednici a zázemí. `[imp:3]` `[owner:me]` `[time:30m]` `[kind:content]`
- [ ] **Značka české přírodní kosmetiky** — dodat chybějící název, nebo potvrdit obecné znění bez značky. `[imp:2]` `[owner:me]` `[time:5m]` `[kind:content]`
- [ ] **Plné E2E proti testovacím službám** — po připojení testovacího Supabase, Stripe, Nuki, Resend a WhatsApp spustit Playwright suite s explicitním mutačním povolením. `[imp:2]` `[owner:ai]` `[time:1h]` `[kind:deploy]`
- [ ] **Povýšit vývojový toolchain po upstream opravách** — úplný `npm audit` eviduje dev-only advisories v transitivech ESLint (`brace-expansion`, `js-yaml`) a Drizzle Kit (`esbuild`), pro které současný kompatibilní strom nenabízí opravu. Produkční strom `npm audit --omit=dev` je čistý; po vydání kompatibilních verzí aktualizovat lockfile a znovu ověřit lint i migrace. `[imp:2]` `[owner:ai]` `[time:30m]` `[kind:deploy]`

## Co do repozitáře nepatří

- databázová hesla;
- Supabase secret / service-role klíče;
- Stripe, Nuki, WhatsApp, Resend, Sentry, GoSMS a cron secrets;
- reálné exporty členů, plateb, logů nebo přístupových kódů;
- lokální `.env.local`.
