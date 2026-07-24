# NAMASTÉ

Rezervační a členský web pro wellness/jóga studio: rezervace lekcí a vstupů,
platby, přístup přes chytrý zámek a jednoduchá administrace obsahu.

## Tech stack

- Next.js (App Router), TypeScript, React
- Supabase (Postgres, Auth) + Drizzle migrace
- Stripe (platby a webhooky)
- Nuki (chytrý zámek — vstupní kódy)
- Resend + WhatsApp (notifikace a pokyny)
- Tailwind CSS

## Třetí strany / integrace

- **Supabase** — databáze, autentizace, RLS.
- **Stripe** — platby za rezervace a členství.
- **Nuki** — generování a ověření vstupních kódů.
- **Resend / WhatsApp** — doručení potvrzení a pokynů.
- **Vercel** — hosting a cron.
