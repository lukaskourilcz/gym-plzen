/**
 * Curated inspiration set — real, verified gyms that run our exact concept:
 * unmanned, smart-lock / PIN access, book-and-pay-online. Compiled 2026-07-18.
 * The long-form writeup with per-claim sources lives in docs/INSPIRATIONS.md;
 * this is the structured version rendered in the admin "Inspirace" section.
 */

export interface Inspiration {
  name: string;
  location: string;
  url: string;
  /** Especially close to our model? */
  closest?: boolean;
  /** Included mainly as a visual-design benchmark (may be staffed). */
  designBenchmark?: boolean;
  access: string;
  booking: string;
  payment: string;
  features: string[];
  /** How their sign-up / booking / login forms & site look and behave. */
  frontend: string;
  ideas: string[];
}

export const INSPIRATIONS: Inspiration[] = [
  {
    name: "Solospace Gym",
    location: "Brno, Česko",
    url: "https://solospacegym.cz/en",
    closest: true,
    access:
      "Bez obsluhy, 24/7. PIN klávesnice u vchodu; kód se objeví v sekci „Bookings“ 24 h před tréninkem.",
    booking:
      "Celý gym jen pro tebe na daný slot, rezervace po hodinách přes online kalendář.",
    payment:
      "Od 160 Kč/h s dynamickou cenou dle dne/času; kreditové balíčky (–25 %); automatické slevy za více slotů (5 % za 5+, 10 % za 10+).",
    features: [
      "Online kalendář dostupnosti",
      "Kreditové balíčky",
      "Slevy za hromadnou rezervaci",
      "Sprchy, smart TV",
    ],
    frontend:
      "Webová rezervace je client-side SPA kalendář: vyber slot → zaplať kartou → vyzvedni PIN v Bookings. Styl čistý minimalismus, modrobílá, hodně fotek vybavení. Nejbližší přímý analog k našemu konceptu (a český).",
    ideas: [
      "Zpřístupnit PIN 24 h před slotem přímo v rezervaci",
      "Automatické slevy za 5+/10+ slotů bez nutnosti členství",
    ],
  },
  {
    name: "The Gym Pods",
    location: "Manhattan, Kansas, USA",
    url: "https://www.thegympods.com/",
    closest: true,
    access:
      "Bez obsluhy; rezervace i vstup přes appku s kalendářem. 24/7. Během rezervace nemá přístup nikdo jiný.",
    booking:
      "Jednomístný privátní gym, rezervace po 30 min až 2 h denně. Onboarding startuje 30min trialem zdarma.",
    payment: "Kreditový systém v appce + členské plány (ceny až po registraci).",
    features: [
      "Kalendář dostupnosti v appce",
      "Zůstatek kreditů",
      "Trial zdarma",
      "Peloton, racky, Smith stroj",
    ],
    frontend:
      "„Gated“ onboarding: 1) webový formulář „request access“ → 2) e-mail s instrukcemi → 3) rezervace v appce → 4) výběr členství. Vizuál minimalistický, typografie na prvním místě.",
    ideas: [
      "30min trial zdarma jako vstup do trychtýře",
      "Denní strop (max 2 h/den) pro férové sdílení jedné místnosti",
    ],
  },
  {
    name: "FlexWerk Fitness",
    location: "Carmel, Indiana, USA",
    url: "https://flexwerkfitness.com/",
    access:
      "Bez obsluhy, „digital keys“. Rezervace na čtyři klepnutí v appce. Otevřeno 5–21 h.",
    booking:
      "Privátní „FlexSpace“ po hodinách jen pro tebe (standard 1–2 os., Plus 3–5 os.). Bez členství, smluv, prohlídek.",
    payment: "Čistě pay-as-you-use, rezervace od 18 $/h, bez členství a smluv.",
    features: [
      "Vlastní appka (postavená na coworkingovém Optix)",
      "Ovládání hudby/světla/teploty",
      "Portál „FitPro“ pro trenéry",
    ],
    frontend:
      "App-first „four-tap“ rezervace; absenci prodejního trychtýře prezentují jako feature. Styl moderní, tech-forward. Postaveno na coworking (desk-booking) softwaru — model je hot-desking pro gymy.",
    ideas: [
      "Plochá, transparentní hodinová cena bez členství jako headline",
      "Samostatný typ účtu „trenér“ pro B2B pronájem prostoru",
    ],
  },
  {
    name: "SOLO60",
    location: "Londýn, UK",
    url: "https://www.solo60.com/",
    access:
      "Bez obsluhy. Rezervace a platba v appce, vstup přes PIN a smart lock. Rezervace až 14 dní dopředu.",
    booking:
      "Jednomístné, po hodinách — privátní gym nebo terapeutická místnost jen pro tebe; 1 host zdarma. 14 poboček.",
    payment:
      "Kredity od ~£2 s dynamickou cenou dle dne/času; zvýhodněné balíčky kreditů; měsíční členství „coming soon“.",
    features: [
      "Nativní appka",
      "Kalendář 2 týdny dopředu",
      "Dynamické ceny",
      "Dárkové karty",
      "Email capture −20 %",
    ],
    frontend:
      "App-first. Web minimalistický, tmavý, velká bílá typografie přes lifestyle fotky, hlavní CTA je stažení appky + lišta na −20 % za e-mail. Rezervace v appce: účet → pobočka → slot → platba → PIN.",
    ideas: [
      "Dynamická cena kreditů dle dne/času pro vyrovnání poptávky",
      "Email capture se slevou na první session před stažením appky",
    ],
  },
  {
    name: "The Gym Pod",
    location: "Singapur (+ Chicago, USA)",
    url: "https://thegympod.com/",
    access:
      "Plně bez obsluhy. „Use the App to unlock the door.“ Bez klíčů/karet, mnoho podů 24/7.",
    booking:
      "Plně privátní jednomístné pody i semi-privátní prostory. Sloty po 30 min, lze řetězit za sebou.",
    payment:
      "Pay-per-use, bez smluv — „only pay when you train“; i předplatné balíčky. 50 % sleva na první rezervaci.",
    features: [
      "Okamžitá rezervace a přeplánování v appce",
      "Ovládání světla/hudby v podu",
      "Referral/testimonials",
    ],
    frontend:
      "App-only trychtýř o třech krocích: stáhni appku + účet zdarma → vyber a rezervuj pod → odemkni appkou. Identita žluto-zlatá na černé, moderní, foto-led.",
    ideas: [
      "30min základní slot s možností „přidat další slot“ jako atomická jednotka",
      "Ovládání prostředí (světlo/hudba) jako produktová feature",
    ],
  },
  {
    name: "My Fit Pod",
    location: "UK (7 měst)",
    url: "https://myfitpod.co.uk/",
    access:
      "Bez obsluhy, 24 h. Přístup přes scanner v appce — přiložíš telefon a dveře se otevřou; nebo záložka „access“ v profilu.",
    booking: "Plně privátní pod, rezervace přes appku. Franšízový rollout.",
    payment:
      "Pay-as-you-go nebo kreditové balíčky; měsíční balíčky dávají slevu na vstup a předrezervace.",
    features: [
      "Nativní appka jako one-stop shop",
      "Samostatná záložka „Access“",
      "Kreditové balíčky",
      "„Blue Light“ slevy",
      "Franšíza",
    ],
    frontend:
      "App-first (stáhni → rezervuj → přilož telefon). Marketing web je Shopify storefront, stejná platforma servíruje promo landing pages. Styl luxusní/premium, čistý.",
    ideas: [
      "Samostatná záložka „Access“ oddělená od rezervace (+ fallback metoda)",
      "Cílené slevové landing pages (např. složky záchranných služeb)",
    ],
  },
  {
    name: "The Yard",
    location: "San Francisco & Mill Valley, USA",
    url: "https://goyard.fit/",
    access:
      "Keyless self-entry přes appku Kisi — zadáš e-mail, dostaneš magic-link, přiložíš telefon ke čtečce. Pozn.: hybrid, má i část obsluhovaných hodin.",
    booking:
      "Rezervace vlastního privátního/semi-privátního podu na 60 min + sdílený venkovní prostor. Rezervace vždy nutná.",
    payment: "$265/měsíc neomezeně, nebo drop-in ~$40–42 (peak/off-peak).",
    features: [
      "Rezervace v appce",
      "Integrace Mindbody + Kisi + ClassPass",
      "Peak/off-peak ceny",
    ],
    frontend:
      "Účty a rezervace na Mindbody, dveře na Kisi — ukázka spojení hotových stacků místo vlastního vývoje. Passwordless „e-mail → magic link“ pro přístup.",
    ideas: [
      "Passwordless e-mail magic-link jako identita pro přístup",
      "Peak/off-peak ceny jako jednoduchý nástroj řízení poptávky",
    ],
  },
  {
    name: "Gymshare",
    location: "USA (marketplace)",
    url: "https://www.gymshare.co/",
    access:
      "Bez obsluhy z principu i pravidlem. „Keyless entry“ u všech gymů, „nikdy nemusíš potkat majitele“. Hosté musí mít i bezpečnostní kamery.",
    booking:
      "Marketplace (Airbnb pro domácí gymy) — rezervuješ privátní domácí gym jen pro sebe. Pozn.: dvoustranná platforma, ne jeden provozovatel.",
    payment: "Členství pro rezervace + platba za rezervaci; bez smluv, „no hidden fees“.",
    features: [
      "Nativní appka",
      "Stav vybavení / dostupnost od hostitele",
      "Komunitní objevování gymů",
      "Onboarding hostitelů",
    ],
    frontend:
      "App-driven, důraz na „free and fast“ registraci; homepage minimalistická, tyrkysová paleta, profesionální fotky prostor. Dva trychtýře — „Gymer“ a „Home Gym Owner“.",
    ideas: [
      "Keyless vstup + kamera jako pravidlo platformy (trust/safety feature)",
      "Positioning „soukromí jako produkt“ (žádné davy, čekání, cizí lidé)",
    ],
  },
  {
    name: "Elysium Gyms",
    location: "Londýn, UK",
    url: "https://elysiumgyms.com/",
    closest: true,
    access: "Bez obsluhy. Dveře odemkne appka na váš slot. Rezervace po hodinách.",
    booking: "Privátní boutique micro-gymy po hodinách; trénink sám, s přáteli nebo s trenérem.",
    payment: "Platba za session nebo kreditové balíčky v appce.",
    features: ["App-first booking", "Keyless entry", "Připomínky", "Více poboček"],
    frontend:
      "Minimalistický, hodně bílého prostoru, barvu nese fotografie. Hero „Private Boutique Training Spaces“ → řada pěti ikon (pobočky / hodinové sloty / keyless / soukromí / komunita) → carousel prostor → newsletter. Bez kalendáře v prohlížeči — web vysvětluje koncept a tlačí do appky.",
    ideas: [
      "Šestikrokový „jak to funguje“ pruh (book → pay → PIN → train)",
      "Řada pěti ikon s odlišujícími vlastnostmi nad ohybem",
    ],
  },
  {
    name: "EVO Fitness",
    location: "Švýcarsko / DE / AT / Nordics",
    url: "https://evofitness.ch/en/",
    closest: true,
    access: "Bez obsluhy přes vlastní systém „Credlock“. Otevřeno ~5–24 h bez recepce.",
    booking: "Prémiové boutique kluby; členství i „no commitment“.",
    payment: "Členství (committed vs no-commitment) + 1 den zdarma.",
    features: ["Signup na samostatné doméně", "Sezónní promo banner", "MyEvo aplikace"],
    frontend:
      "High-contrast boutique: tmavá pozadí, neonové EVO nápisy ve fotkách, čistý sans-serif. Hero se třemi chipy hodnot + plovoucí promo („50% off summer“). Vedle sebe dvě cenové úrovně s cenou i podmínkami. Silná sociální proof.",
    ideas: [
      "Cenové úrovně vedle sebe (per-hodinu vs členství)",
      "Plovoucí, zavíratelný promo banner nad klidným hero",
    ],
  },
  {
    name: "NEXT DOOR (Just Fit)",
    location: "Kolín n. R. / Düsseldorf, DE",
    url: "https://www.nextdoorgyms.de/en",
    closest: true,
    access: "Plně digitální, bez personálu. Vstup app/transpondér, 6–24 h.",
    booking: "„Neighbourhood“ gym řízený chytrými stroji EGYM; bez trenérů a recepce.",
    payment: "Od 29,90 €/měs, flexibilní délka 1 týden–24 měs.",
    features: ["Účet za 5 minut", "Bez objednání", "FAQ akordeon", "EGYM Genius AI"],
    frontend:
      "Moderní minimalismus, tmavé UI s bílým prostorem. Hero přímo říká „staffless gym“ — koncept JE headline. Ikonové karty kategorií → benefit list → testimonials → loga partnerů → FAQ akordeon. Signup prodává rychlost a samostatnost.",
    ideas: [
      "Udělat z bez-obsluhy hlavní headline (buduje důvěru)",
      "FAQ akordeon předjímající „jak se dostanu dovnitř“",
    ],
  },
  {
    name: "Barerooms",
    location: "Birkenhead (Wirral), UK",
    url: "https://barerooms.com/",
    closest: true,
    access: "Bez obsluhy + app-access. Check-in i vstup přes appku (Wellyx).",
    booking: "Privátní vybavené místnosti po hodinách/půlhodinách; sloty se stagerují tak, aby se lidé nepotkali.",
    payment: "Pay-as-you-go nebo členské úrovně (Silver/Gold/Platinum).",
    features: ["Sloty na hodinu/půlhodinu", "Bez walk-ins", "Golf sim, VR, projektor"],
    frontend:
      "Tmavá pozadí, bílý text, průhledné logo. Copy cílí na soukromí („no wandering eyes, no waiting“). Booking, platby i check-in v appce; web = koncept + úrovně členství.",
    ideas: [
      "„Stagerované sloty na hodinu, nikoho nepotkáte“ jako selling point v pickeru",
      "Úrovně jako „X privátních sessions týdně“",
    ],
  },
  {
    name: "Barry's",
    location: "globálně (vznik LA, USA)",
    url: "https://www.barrys.com/",
    designBenchmark: true,
    access: "Obsluhovaný boutique HIIT řetězec („Red Room“). Design benchmark.",
    booking: "Rezervace lekcí; location-first vícekrokový flow (studio → datum → lekce → potvrzení).",
    payment: "Balíčky lekcí / členství.",
    features: ["Zapamatování polohy", "≤3 kroky k potvrzení", "Silné CTA"],
    frontend:
      "Tmavé, high-contrast, near-black pozadí s bílým písmem — nightclub nálada. Full-width hero (zvlášť desktop/mobil) + promo banner. Silný narativní scroll: hero → Red Room video → Run vs Lift → benefit karty → instruktoři → amenity → testimonials.",
    ideas: [
      "Tmavé UI + jeden horký akcent + teplá kontrastní fotografie",
      "„Book your first class“ jako jediné dominantní CTA, ≤3 kroky",
    ],
  },
  {
    name: "Gymbox",
    location: "Londýn, UK",
    url: "https://gymbox.com/",
    designBenchmark: true,
    access: "Obsluhovaný, záměrně divoký boutique (DJ, světla). Bold design benchmark.",
    booking: "Trial / rozvrh / join na samostatných subdoménách.",
    payment: "Členství s tvrdou nabídkou (např. „£10 do října“).",
    features: ["Live countdown timer", "UGC galerie „Spotted in the Box“", "70+ lekcí"],
    frontend:
      "Tmavá nightclub estetika, dramatické světlo, high-contrast sans-serif. Hero „ANYTHING GOES“ + tvrdá nabídka + odpočítávání. Divadelní fotografie (lazy-load). Sekce: vybavení → 70+ lekcí → recovery tech → UGC galerie → FAQ.",
    ideas: [
      "Live countdown na launch nabídku jako konverzní páka",
      "UGC galerie („skuteční lidé v našem prostoru“) pro důvěru",
    ],
  },
  {
    name: "Third Space",
    location: "Londýn, UK",
    url: "https://www.thirdspace.london/",
    designBenchmark: true,
    access: "Obsluhovaný luxusní health-club. Prémiový/minimalistický benchmark.",
    booking: "Minimalistický modal „Enquire → vyber možnost“ místo dlouhého formuláře.",
    payment: "Členství (poptávka přes modal).",
    features: ["Light/dark branding", "Modulární karty", "Nízko-frikční lead capture"],
    frontend:
      "Čisté, zdrženlivé, prémiové — světlá i tmavá varianta loga/módu, moderní sans-serif. Hero full-bleed s „Training for life“ a dvěma CTA. Modulární karty (lekce, vybavení, PT, výživa).",
    ideas: [
      "Light/dark-aware branding od začátku (působí prémiově)",
      "Krátký modal „enquire / vyber možnost“ místo dlouhého formuláře",
    ],
  },
  {
    name: "Alchemy 365",
    location: "Denver, USA",
    url: "https://alchemy365.com/",
    designBenchmark: true,
    access: "Obsluhované strength boutique studio. Čistý, motion-forward design.",
    booking: "Rozvrhy na stránkách poboček s kotvami.",
    payment: "Trial „3 za $30“, dále členství.",
    features: ["Jeden akcent (modrá)", "Instagram feed komunity", "Motion + foto"],
    frontend:
      "Sebevědomé jednoakcentové (modré) schéma kolem kruhového loga; moderní sans-serif; mix pohybu a statické fotografie. Hero „Pursue Your Legend“ + konkrétní trial hook. Sekce pozicují strength a tři módy (group / open gym / private).",
    ideas: [
      "Jeden výrazný akcent přes černobílou (bez all-dark klišé)",
      "Levný konkrétní trial („3 za $30“) v hero konvertuje líp než „join today“",
    ],
  },
  {
    name: "1Rebel",
    location: "Londýn / UAE / Austrálie",
    url: "https://www.1rebel.com/",
    designBenchmark: true,
    access: "Obsluhovaný immersive boutique. Bold digital-brand benchmark.",
    booking: "Intent-first: „I WANT TO TRAIN: ___“ → najdi session; appka řeší nákup a výběr místa.",
    payment: "Balíčky / drop-in; výběr konkrétního místa/kola.",
    features: ["Intent-first filtr", "Výběr konkrétního místa", "Konzistentní brand web↔app"],
    frontend:
      "Bold, high-energy, konzistentní identita web→app→sociální sítě; optimalizované obrázky. Vstup přes přepínač země/pobočky. Booking začíná filtrem podle záměru, teprve pak rozvrh.",
    ideas: [
      "Intent-first filtr „Chci si rezervovat: [1 h / s přítelem]“ před kalendářem",
      "Vizuální výběr jediného bookovatelného prostoru jako jednotky",
    ],
  },
];

/** Cross-cutting patterns worth copying, shown as a summary on the page. */
export const INSPIRATION_TAKEAWAYS: string[] = [
  "Bez smluv, plochá a transparentní cena za vstup — přesně náš model 290 Kč (FlexWerk).",
  "Prepaid balíčky / kredity místo měsíčního předplatného — doplní naši věrnost „každý 10. zdarma“.",
  "Silná nabídka na první návštěvu (trial zdarma nebo −50 %) jako hlavní CTA.",
  "Zpřístupnit PIN ~24 h před slotem přímo v účtu člena (Solospace).",
  "PIN klávesnice s časově omezeným kódem = přesně náš Nuki model.",
  "Samostatná obrazovka „Přístup“ + záložní kanál, aby se člen nikdy nezamkl venku.",
  "Denní strop rezervací pro férové sdílení jedné místnosti (The Gym Pods).",
  "Samostatný typ účtu „trenér“ pro B2B pronájem prostoru.",
  "„Soukromí jako produkt“ — emoční jádro celé kategorie.",
];
