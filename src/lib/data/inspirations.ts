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
