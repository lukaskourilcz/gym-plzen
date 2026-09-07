# Předání session

Aktualizováno 7. 9. 2026. Produkční audit a opravy jsou na větvi
`codex/production-review-2026-09-07`, výchozí main
`cceaada53bae58131c95205c7ed0f6961873d68e`.

## Stav

- Dokončené opravy souběhů rezervací/plateb/storna, pražských časů, admin
  kalendáře, Nuki kódů, retry pipeline a formulářů.
- Přidány izolované Postgres/Nuki regresní testy, CI a bezpečný env preflight.
- Odstraněné nepoužívané exporty a devět historických dokumentů; právní
  omezení z HANDOFF jsou zachována v produkčním checklistu.
- Živá DB byla kontrolována pouze čtecími dotazy. Žádné skutečné platby,
  rezervace, e-maily ani operace na zámku nebyly provedené.
- **NO-GO pro ostré objednávky**: produkční Vercel klíče nebyly dostupné,
  externí E2E a skutečné responzivní zobrazení nejsou ověřené.

## Důkazy a další práce

[docs/PRODUCTION_CHECKLIST.md](./docs/PRODUCTION_CHECKLIST.md) je jediný aktuální
přehled výsledků, rizik a přejímacích scénářů. [NEEDED.md](./NEEDED.md) obsahuje
úkoly pro provozovatele a [MANUAL_STEPS.md](./MANUAL_STEPS.md) jejich postup.
Nepřebírat starší odhady stavu klíčů jako ověření produkce.

Dva podporované pokusy o browser preview selhaly (start Next.js/SWC); další
pokusy neopakovat bez vyřešení prostředí. Produkční build s vypnutou build
telemetrií funguje. Automatický review prvního buildu odmítl odchozí Sentry
telemetrii; tato konfigurace je nyní vypnutá, source maps se bez tokenu neodesílají.

## Praktické poznámky

- Node 22; `npm test` používá `node --import tsx --test`, což nevyžaduje IPC
  server CLI tsx. `npm run test:integration` používá experimentální Node module
  mocks a PGlite, nikdy produkční DB.
- Nevytvářet druhou databázi ani neupravovat Supabase migrační historii naslepo.
- `internal:reservation-operation` je namespace obnovitelného lease v existující
  tabulce webhook_event. Doba lease je 10 min, funkce mají limit 300 s.
- Nuki 204 není úspěšné vytvoření. Při nejasném stavu bez auth ID vyžadovat
  kontrolu skutečných autorizací před nahrazením kódu.
- Smazané plány jsou dostupné v historii Gitu. Obě vizuální varianty a jejich
  přepínač zůstávají, dokud provozovatel nerozhodne o výchozí podobě.
