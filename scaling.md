# NAMASTÉ — náklady a škálování

Rezervační web na Vercelu se Supabase, Stripe, Nuki a Resendem. Technologický
stack je v `about-project.md`; tento soubor řeší jen náklady a škálování.
Ceny orientační, ověřit v konzolích poskytovatelů.

## Co to stojí

| Režim | Fixní náklady | Variabilní | Praktický součet |
|---|---|---|---|
| Vývoj / demo | Vercel Hobby, Supabase Free | 0 | ~$0/měs |
| Malý provoz studia | Vercel Pro $20, Supabase Pro $25 | Stripe poplatky (~1.4%+), Resend | ~$45–70/měs + poplatky z plateb |

## Škálování a spouštěče

- **Supabase**: navýšit compute až při trvalé saturaci připojení/CPU, ne podle počtu členů.
- **Vercel**: Pro je potřeba kvůli komerčnímu provozu a cronu; sledovat Function/Edge využití.
- **Stripe/Resend/Nuki**: náklady rostou s objemem plateb a notifikací — lineární, sledovat měsíčně.

## Kontrola nákladů

Nastavit rozpočtová upozornění (Vercel, Supabase), ověřit free-tier limity
Resendu a Nuki, a sledovat počet rezervací vs. platebních poplatků.
