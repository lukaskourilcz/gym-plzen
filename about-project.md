# NAVI Private Gym

Rezervační a členský web pro samoobslužné soukromé fitness v plzeňské části
Roudná.
Jeden klient si rezervuje 75minutové časové okno, zaplatí jednorázový vstup a
obdrží časově omezený přístupový kód. Součástí je veřejný web, členský účet,
obsahová i provozní administrace a věrnostní pravidlo každého 10. vstupu zdarma.

## Tech stack

- Next.js 15 (App Router), React 19, TypeScript
- Supabase (Postgres, Auth) + Drizzle migrace
- Stripe (platby a webhooky)
- Nuki (chytrý zámek a vstupní kódy)
- Resend + WhatsApp (notifikace a pokyny)
- Tailwind CSS 4, Bitter, Lucide
- Sentry, Vercel Analytics a Vercel Cron

- FullCalendar 6 + Luxon: admin kalendář v Europe/Prague
- Node test runner + PGlite: izolované databázové regresní testy

## Třetí strany / integrace

- **Supabase** — databáze, autentizace a RLS; registrační a resetovací e-maily
  odesílá přes Resend SMTP. Jejich české šablony se z administrace
  synchronizují přes serverový Management API token.
- **Stripe** — jednorázové platby za rezervace.
- **Nuki** — generování a ověření vstupních kódů.
- **Resend / WhatsApp** — doručení pěti e-mailových šablon, vstupních kódů a
  provozních pokynů; Resend je poskytovatelem SMTP pro Supabase Auth.
- **Sentry** — sledování chyb a výkonu.
- **Vercel** — hosting, analytika a cron.

Popis integrací vyjadřuje implementaci. Aktuální provozní ověření je v
[produkčním checklistu](./docs/PRODUCTION_CHECKLIST.md).
