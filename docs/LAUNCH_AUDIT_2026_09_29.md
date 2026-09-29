# Audit před otevřením — 29. 9. 2026

Průběžný záznam kontroly na žádost vlastníka. Hlavní [issue #105](https://github.com/lukaskourilcz/gym-plzen/issues/105).

## Prostředí a ochrana produkce

- Výchozí commit `113a794`, samostatný worktree a větev `codex/launch-audit-20260929`.
- Produkční `.env.local` není do worktree zkopírovaný. Kontroly běží s vyčištěným prostředím.
- Node.js 22.23.3. Nový lokální Postgres na `127.0.0.1:55439`, databáze `navi_launch_audit_test`.
- E-mail a platební brána používají lokální zaznamenávající náhrady. Žádný skutečný zákazník, platba, zámek nebo WhatsApp účet se v testech nepoužije.
- Žádná produkční migrace, změna dat ani nasazení z této větve.

## Výchozí kontroly

| Kontrola | Výsledek |
| --- | --- |
| Unit testy | 239 prošlo, 0 přeskočeno |
| TypeScript | prošel |
| ESLint | prošel |
| Integrační a browser testy | probíhá příprava izolovaného prostředí |

## Rozsah

Rezervace, objednávky, platby, vouchery, věrnost, autentizace, profil, změny a storno, vstupní kódy, doručování, watchdog, administrace, veřejný web a skutečný význam testů. Závěrečné výsledky a jednotlivá issues budou doplněny průběžně.
