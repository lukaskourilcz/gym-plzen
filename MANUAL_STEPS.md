# Manuální nastavení integrací

Cílová doména: `https://www.navigym.cz`.
Supabase project ref: `rkmunagymohxtclymacm`.
Aktuální neověřené body jsou v [NEEDED.md](./NEEDED.md), přejímka v
[produkčním checklistu](./docs/PRODUCTION_CHECKLIST.md).
Tento dokument je návod, nikoli potvrzení aktuálního nastavení účtů.

## 1. Vercel a prostředí

1. Vybrat projekt a Node.js 22.x.
2. Podle `.env.example` nastavit produkční proměnné; tajné hodnoty výhradně
   na serveru. `NEXT_PUBLIC_*` se dostanou do prohlížeče.
3. Production a Preview oddělit: preview má vlastní DB, Stripe test, testovací
   schránky a zámek. Nekopírovat do něj automaticky všechny produkční klíče.
4. Po změně veřejných env provést nový build. `NEXT_PUBLIC_APP_URL` musí být
   správná HTTPS doména bez cesty. Demo flags do produkce nedávat.
5. Spustit `npm run check:production-env` v bezpečném prostředí. Výsledek
   dokládá jen přítomnost/tvar konfigurace, nikoli platnost u poskytovatele.

Sentry build telemetrie je vypnutá. Upload source maps se zapne pouze s
`SENTRY_AUTH_TOKEN`; runtime monitoring má samostatný DSN.

## 2. Supabase Auth, DB a administrace

V [Supabase URL Configuration](https://supabase.com/dashboard/project/rkmunagymohxtclymacm/auth/url-configuration):

- Site URL nastavit na `https://www.navigym.cz`.
- Povolit konkrétní callback adresy používané aplikací pro dané prostředí.
  V produkci nepovolovat obecný wildcard pro všechny cizí `*.vercel.app` projekty.
- Ověřit potvrzení e-mailu, bezpečnou změnu e-mailu a ochranu kompromitovaných hesel.
- `NEXT_PUBLIC_OAUTH_PROVIDERS` vyplnit pouze poskytovateli, kteří jsou
  skutečně nastavení a vyzkoušení v Supabase. Google login ověřit i v Safari.
- `DATABASE_URL`, veřejný Supabase URL a serverové aliasy musí patřit stejné
  databázi. Pro aplikaci použít transaction pooler s `prepare:false`, pro
  migrace `DIRECT_URL`.
- Vytvořit a ověřit skutečné správce; rezervované demo účty následně odstranit.
- Před migracemi nejprve porovnat schéma a historii, zajistit zálohu a izolovaný staging.

## 3. Stripe

Ve [Stripe Dashboardu](https://dashboard.stripe.com/webhooks) ověřit:

- Live endpoint `https://www.navigym.cz/api/webhooks/stripe` a jeho podpisový
  secret v `STRIPE_WEBHOOK_SECRET`.
- Události `checkout.session.completed`, `checkout.session.expired`,
  `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`.
  Nový checkout používá karetní platby; obsluha async událostí zůstává pro starší sessions.
- Stripe secret odpovídá prostředí. `whsec_` z CLI listeneru není automaticky
  podpisovým klíčem produkčního Dashboard endpointu.
- Testovací platby směrovat na testovací endpoint a DB, nikoli produkci.
- Zkontrolovat podpis, částku, měnu, stav rezervace a opakování události.
  Zrušení rezervace v administraci **neprovádí refundaci**; tu musí obsluha
  vyřídit ve Stripe a ověřit výsledek.

## 4. Nuki

V [Nuki Web](https://web.nuki.io/) ověřit token se správnými oprávněními,
`NUKI_SMARTLOCK_ID` a webhook `/api/webhooks/nuki` s nakonfigurovaným secretem.

Příkazy pro autorizace jsou asynchronní. Aplikace čeká na ověřitelný výsledek
v seznamu autorizací; nepovažuje samotné HTTP 204 za úspěch. PIN je šest číslic
1–9 bez počátečního 12. Název `NAVI-…` odpovídá ID řádku `access_code`.

Fyzický test: kód před platností odmítnut → uvnitř časového okna odemkne →
po konci + sprše odmítnut → ruční storno/přesun odvolá starý kód. Ověřit také
offline zámek a ztracenou odpověď. Při nejasném stavu porovnat autorizace a DB,
odstranit případný osiřelý kód a teprve pak obnovit pipeline. Nikdy neoznačit
kód za odvolaný jen proto, že API neodpovědělo.

Referenční rozhraní: [Nuki Web API](https://api.nuki.io/).

## 5. Resend, SMTP a editace e-mailů

1. Ověřit odesílací doménu v Resendu a odpovídající DNS záznamy.
2. Nastavit `RESEND_API_KEY` a `RESEND_FROM_EMAIL` pro tuto doménu.
3. V [Supabase SMTP](https://supabase.com/dashboard/project/rkmunagymohxtclymacm/auth/smtp)
   nastavit vlastní SMTP podle aktuálních údajů Resendu. Sender musí být ověřený.
4. Pro synchronizaci Auth šablon z administrace nastavit serverový
   `SUPABASE_MANAGEMENT_API_TOKEN` s oprávněním konfigurovat příslušný projekt.
   Staging token/URL nesmějí upravovat produkční Auth.
5. V administraci → E-maily uložit a zkontrolovat registraci, reset, potvrzení
   rezervace, vstupní kód a storno. Test posílat jen na předem určenou adresu.
6. Projít skutečnou testovací registraci a reset. V doručené poště ověřit
   sender, češtinu, logo a ICS přílohu původního/přesunutého termínu.

## 6. WhatsApp, SMS a monitoring

Adaptér `whatsapp.ts` používá přímo Meta Graph API. Vyžaduje konfiguraci
`WHATSAPP_*`, schválenou utility šablonu `access_code` v češtině, telefonní ID,
token a webhook ověření. Zernio je pouze dříve zvažovaná alternativa.
GoSMS je volitelný kanál s `GOSMS_*`; neslibovat jej, dokud není ověřený.

V `vercel.json` je watchdog každých 5 minut a synchronizace vstupů po 15 minutách.
Ověřit podporu tarifu, `CRON_SECRET`, maximální délku běhu a provozní logy.
Nastavit a otestovat externí heartbeat i skutečné příjemce kritických alertů.
Záznam v administraci nenahrazuje funkční pohotovostní kontakt.

## 7. Mapa, měření a obsah

- Vlastní Maps marker vyžaduje klíč i Map ID, správné HTTP referrery pro NAVI,
  zapnutou službu a billing. Bez těchto hodnot zůstává standardní embed.
- GA4/Meta IDs jsou volitelné; při nastavení ověřit consent flow. Preview nemá
  automaticky sbírat produkční analytiku.
- Ověřit CMS kontakt, ceny, blokace, média a nahrazení ilustračních fotek.
- V nastavení potvrdit fakturační údaje a DPH před zapnutím dokladů.
- Při změně domény aktualizovat Auth callbacky, Stripe/Nuki webhooky,
  Maps referrery, e-mailové odkazy a přesměrování staré domény.
