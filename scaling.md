# NAVI - náklady a škálování

Rezervační web na Vercelu se Supabase, Stripe, Nuki a Resendem. Technologický
stack je v `about-project.md`; tento soubor řeší jen náklady a škálování.
Ceny jsou orientační stav k 30. 7. 2026 bez DPH a kurzových rozdílů. Před
rozhodnutím je ověřte v konzolích poskytovatelů.

## Co to stojí

| Režim             | Fixní náklady                             | Variabilní                                           | Praktický základ |
| ----------------- | ----------------------------------------- | ---------------------------------------------------- | ---------------- |
| Vývoj / demo      | Vercel Hobby, Supabase Free               | Případné placené zprávy                              | Od 0 USD/měsíc   |
| Malý ostrý provoz | Vercel Pro 20 USD, Supabase Pro od 25 USD | Stripe, zprávy, Sentry a využití nad zahrnuté limity | Od 45 USD/měsíc  |

Stripe pro standardní evropské karty v ČR uvádí 1,5 % + 6,50 Kč za úspěšnou
online platbu. Aktuální podmínky:
[Vercel](https://vercel.com/pricing),
[Supabase](https://supabase.com/pricing) a
[Stripe](https://stripe.com/en-cz/pricing).

## Škálování a spouštěče

- **Supabase**: navýšit compute až při trvalé saturaci připojení/CPU, ne podle počtu členů.
- **Vercel**: pro komerční provoz použít Pro a sledovat compute, přenosy a
  optimalizaci obrázků.
- **Stripe, Resend a Nuki**: náklady rostou s objemem plateb a notifikací.
  Kontrolovat je měsíčně proti počtu dokončených rezervací.

## Kontrola nákladů

Nastavit rozpočtová upozornění (Vercel, Supabase), ověřit free-tier limity
Resendu a Nuki, a sledovat počet rezervací vs. platebních poplatků.
