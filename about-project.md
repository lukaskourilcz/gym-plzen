# NAMASTÉ Private Gym

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

## Třetí strany / integrace

- **Supabase** — databáze, autentizace, RLS.
- **Stripe** — jednorázové platby za rezervace.
- **Nuki** — generování a ověření vstupních kódů.
- **Resend / WhatsApp** — doručení potvrzení a pokynů.
- **Sentry** — sledování chyb a výkonu.
- **Vercel** — hosting, analytika a cron.
