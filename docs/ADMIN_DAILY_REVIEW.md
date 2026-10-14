# Úpravy denních přehledů administrace

Větev `codex/admin-daily-refinements` vychází z `main` na
`587b541623a439165814886bafa455843458a42b`. Issues: #218, #219, #220, #221, #222.

## Výsledek

- Zítra používá od desktopového breakpointu `lg` tabulku: Čas, Jméno,
  Nuki kód, Email, Whatsapp, Potvrzeno, Rezervace a Profil zákazníka.
  Poslední dvě akce mají malé ikonové sloupce a tooltipy. Na mobilu zůstávají
  karty. Poznámky zákazníků jsou zachované v obou zobrazeních.
- WhatsApp zobrazuje fajfku/X podle nastaveného používání; čekání na platbu
  nemění tuto informaci. Stav přípravy kódu i doručení zůstává beze změny.
  Label odeslání zní „Hodinu předem“. Úvodní vysvětlující odstavec byl odstraněn.
- Nadpisy Dnes a Zítra mají datum ve stejném řádku. Datum je nadále dynamické
  podle Prahy; na úzkém mobilu se může přirozeně zalomit.
- Dnešní vstupy byly načtené celé, ale UI ořezávalo výsledek na osm nejnovějších.
  Nově se stránkují po 20, dotaz čte jen stránku a jeden řádek navíc pro tlačítko
  Další. Pořadí je stabilní podle času a ID; starší vstupy jsou dosažitelné přes
  stránkování. Zachované jsou původní hranice pražského dne.
- Pravý sloupec již nepřebírá výšku Dnešního programu. Svislé mezery jsou 32px,
  stejně jako mezera mezi levým a pravým sloupcem.
- Přidání cenového období otevře existující formulář v dialogu; na stránce
  zůstává zelené tlačítko Přidat období. Zrušení/Escape vrací fokus, úspěšné
  uložení dialog zavře a obnoví seznam. Původní úprava uloženého období,
  validace a inkluzivní datum konce zůstávají zachované. Identifikátory polí
  jsou jedinečné i při otevření dialogu nad editací existujícího období.
- Z Jak co funguje? byla odstraněna celá sekce Co najdu v administraci,
  včetně otázky Jak číst dva pohledy ve Financích? a odkazu v obsahu.

## Ověření

Node.js 22.23.3, vlastní lokální Postgres a lokální náhrady Auth/Resend/Comgate.
Testovací runner odmítá produkční URL i externí požadavky.

- 287 základních, 185 integračních a 123 prohlížečových testů prošlo.
- Čtyři nové prohlížečové scénáře prošly také samostatně, s nulou zpráv
  v lokální mailové službě. Kontrolují desktop/mobil, tooltipy, poznámku,
  stránku se staršími vstupy, rozestupy a ukládání období z dialogu.
- Ověřeno, že prohlížení a lokální uložení cenového období nemění rezervace
  ani počet zpráv. Testy stránkování pokrývají 45 záznamů, shodné časy,
  přesnou hranici dne a neexistující další stránku.
- Produkční sestavení, lint, typy, formát a SQL omezení prošly.
- Produkční audit závislostí: 0 nálezů. Úplný audit nadále hlásí pět high
  položek původního vývojového řetězce (#204); audit nebyl vypnut ani skryt.

## Náhled a nasazení

Náhled je na `http://127.0.0.1:3132/admin`, přihlášení
`admin@preview.example.test` / `Nahled2026!`. Používá samostatnou lokální
`gym_preview_test` s fiktivními rezervacemi a 23 ukázkovými vstupy.
Žádná z těchto dat se neposílají na produkci. Náhled žije jen po dobu běhu procesu.

Změna je pouze v administraci a jejích čtecích službách. Neobsahuje databázovou
migraci, změnu produkčního ceníku, rozvrhu, rezervací, zámku či odesílání zpráv.
Automatické Vercel nasazení pracovní větve je vypnuté; veřejný web se nemění.
