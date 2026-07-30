# Předání session

Aktualizováno: 31. 7. 2026

## Stav

Klientská revize veřejného webu je implementovaná a připravená k prezentaci.
Veřejný header používá přesné dodané logo v horizontálním uspořádání: lotus
vlevo a wordmark `Namasté Private Gym` vpravo. Vertikální varianta zůstává na
přihlášení a v patičce.

Úvodní stránka odpovídá klientským poznámkám: širší navigace, tečka za „Tvoje
Namasté.“, Plzeň - Roudná, otevírací doba 5:00–23:45, informační pás v prvním
viewportu, vycentrované časy, každý 10. vstup zdarma, stejně velké kroky 01–06,
bílá cenová karta, horizontální závěrečná výzva a adresa nad mapou i v mapě.
Kontaktní blok je jeden levý sloupec pod nadpisem „Kde nás najdete“: adresa,
e-mail a telefon. Samostatná otevírací doba ani svislé oddělovače v tomto bloku
nejsou.
Šest provozních kroků používá zlaté štítky 01–06 přímo před nadpisy. Nadpisy
mají v každém řádku společnou výšku a navazující text začíná pod nimi ve stejné
úrovni. Všechny podpůrné lotusové motivy používají oficiální klientskou
pětilistou značku; FAQ zachovává její animaci při otevření.
Favicon v `src/app/icon.png` používá stejný přesný klientský lotus ve zlaté
barvě na tmavě zeleném podkladu. Starý ručně kreslený SVG favicon byl odstraněn.
Mapa se načítá vycentrovaná pomocí souřadnic, takže Google automaticky
nezobrazuje druhou informační kartu. Viditelný zůstává pouze vlastní přední
karta NAMASTÉ a vlastní lotusový marker.
Závěrečný zelený CTA pás drží na desktopu tlačítko „Rezervovat“ 80 px od
nadpisu; už se neroztahuje k pravému okraji kontejneru.
Cenová karta je zjednodušená na cenu, délku vstupu, sdělení „Celý gym jen pro
vás“ a rezervační tlačítko. Nemá samostatný label „Vstupné“, opakovaný věrnostní
text ani poznámku o registračních poplatcích.
Kořenový layout je výškový flex sloupec a přímý `main` vyplňuje volné místo.
Footer proto končí u spodního okraje viewportu na krátkých veřejných stránkách
a za obsahem na stránkách delších.

`/faq` obsahuje všech dvacet klientem dodaných otázek a odpovědí. Cena, délka
slotu a otevírací doba používají sdílenou konfiguraci. Odkazy na Kontakt a
Vybavení vedou na existující cíle a stránka generuje `FAQPage` strukturovaná
data.

## Potvrzené podklady

- adresa: `Křížkova 424/23, Plzeň - Roudná`;
- otevírací doba: každý den 5:00–23:45;
- slot: 75 minut;
- kapacita: až 5 osob včetně dětí;
- cena: 290 Kč za rezervaci, každý 10. vstup zdarma;
- Instagram: `@namaste_plzen`;
- logo: zdroj od klienta, odvozené transparentní soubory jsou v
  `public/images/namaste-logo.png`, `namaste-lotus.png` a
  `namaste-wordmark.png`.

Nepoužívat telefon, e-mail ani další kontakty z Wix šablony. Aktuální telefon,
e-mail a Facebook jsou stále zástupné hodnoty a jsou vedené v `NEEDED.md`.

## Demo

Lokální demo vyžaduje `DEMO_AUTH_ENABLED=true`,
`DEMO_AUTH_SECRET` dlouhý alespoň 32 znaků a volitelně
`BOOKING_PREVIEW_FIXTURE=true`.

- administrace: `admin@namaste.demo` / `namaste2026`;
- klientský účet: `klient@namaste.demo` / `namaste2026`.

Přihlašovací stránka tyto údaje vizuálně neprozrazuje. Demo režim se v produkci
automaticky vypne.

## Poslední ověření

Vše běželo na Node 22:

- `npm run format:check`: prošlo;
- `npm run lint`: prošlo;
- `npm run typecheck`: prošlo;
- `npm test`: 17 passed;
- lokální demo a veřejné Playwright scénáře: 10 passed;
- produkční veřejný smoke test bez databáze: 8 passed, 1 očekávaně skipped;
- produkční skip-link stress test: 5/5 passed;
- `npm run build`: prošlo bez `DATABASE_URL`, nedostupná DB správně přepne web
  na bezpečný fallback;
- `npm audit --omit=dev`: 0 zranitelností;
- plný `npm audit --audit-level=high`: 13 vývojových nálezů (9 high,
  4 moderate) v tranzitivních závislostech ESLint a Drizzle Kit. Automatická
  oprava vyžaduje breaking downgrade nebo upgrade, proto nebyl použit
  `npm audit fix --force`.

Vizuálně byly ověřeny desktop 1440 × 900 a mobil 390 × 844. Responzivní měření
proběhlo od 320 do 1728 px bez horizontálního overflow. Mobilní menu, login,
FAQ accordion, focus, Escape a reduced motion mají regresní pokrytí.

## Co zbývá

Úkoly vyžadující klienta nebo externí služby jsou v
[NEEDED.md](./NEEDED.md). Nejdůležitější jsou:

1. skutečný telefon a e-mail;
2. skutečná Facebook URL;
3. schválené právní texty a provozní řád;
4. finální fotografie jednotlivých zón;
5. potvrzený Supabase projekt a ostré ověření Stripe, Nuki a doručování.

Nejasnou část poznámky „menu více roztáhlé a možná tiskace?“ jsme neinterpretovali
jako samostatnou funkci. Menu je více roztažené, ale žádný další prvek podle
nejasného slova nebyl přidán.

## Orientace v repozitáři

- aktuální stav produktu: [README.md](./README.md);
- externí kroky: [NEEDED.md](./NEEDED.md) a
  [MANUAL_STEPS.md](./MANUAL_STEPS.md);
- vizuální pravidla: [docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md);
- poslední audit: [docs/UX_AUDIT.md](./docs/UX_AUDIT.md);
- E2E režimy: [tests/e2e/README.md](./tests/e2e/README.md).
