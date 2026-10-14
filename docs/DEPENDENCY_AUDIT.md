# Oprava auditu vývojových závislostí (#204)

`braces` 3.0.3 nemá opravenou publikovanou verzi pro
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
Do projektu se dostával pouze přes vývojový řetězec
`eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch`.

V `package.json` je proto override omezený na `fast-glob` uvnitř
`@next/eslint-plugin-next`. Instalujeme pod tímto názvem přesný npm alias
`tinyglobby` 0.2.17, který nepoužívá `braces` ani `micromatch`.
Next plugin využívá z tohoto balíčku pouze `globSync(pattern, { onlyDirectories: true })`
pro vyhledání kořenových složek z nastavení `settings.next.rootDir`.
[Tinyglobby](https://github.com/SuperchupuDev/tinyglobby) toto rozhraní podporuje.
Nejde o obecnou náhradu všech API knihovny `fast-glob`.
Tinyglobby vrací adresáře relativně k pracovní složce a s koncovým lomítkem;
Next je zpracovává přes `path.join` a `fs`, takže výsledná složka zůstává stejná.

Regresní testy v `tests/unit/eslint-root-dirs.test.ts` ověřují výchozí kořen,
adresářové a složené vzory, seznam kořenů, prázdný výsledek a skutečné hlášení
pravidla `no-html-link-for-pages`. Při budoucí aktualizaci Next lint pluginu je
potřeba znovu ověřit jeho použití glob API a override odstranit, až upstream
přestane záviset na zranitelném řetězci.

Verze Next.js, ESLintu, lintovací pravidla i produkční závislosti zůstávají stejné.
Oba bezpečnostní audity v CI zůstávají zapnuté bez výjimek.
