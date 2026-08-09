export type ContentEditorKey = string;

export interface ContentEditorItem {
  key: ContentEditorKey;
  label: string;
}

export interface ContentEditorSection {
  title: string;
  description: string;
  items: readonly ContentEditorItem[];
}

const item = (key: ContentEditorKey, label: string): ContentEditorItem => ({
  key,
  label,
});

const FAQ_ITEMS = Array.from({ length: 20 }, (_, index) => {
  const number = index + 1;
  return [
    item(`faq.${number}.question`, `Otázka ${number}`),
    item(`faq.${number}.answer`, `Odpověď ${number}`),
  ] as const;
}).flat();

/**
 * The client-facing content map. It intentionally contains human labels only;
 * internal CMS keys, content types and groups never appear in the editor UI.
 */
export const CONTENT_EDITOR_SECTIONS: readonly ContentEditorSection[] = [
  {
    title: "Hero",
    description: "První obrazovka úvodní stránky a její výzvy k rezervaci.",
    items: [
      item("brand.name", "Název značky"),
      item("home.hero.badge", "Krátký štítek"),
      item("home.hero.title", "Hlavní nadpis"),
      item("home.hero.titleAccent", "Zlatá část nadpisu"),
      item("home.hero.subtitle", "Úvodní text"),
      item("home.hero.addressLabel", "Popisek adresy"),
      item("home.hero.hoursLabel", "Popisek otevírací doby"),
      item("home.hero.primaryCta", "Hlavní tlačítko"),
      item("home.hero.secondaryCta", "Vedlejší tlačítko"),
    ],
  },
  {
    title: "Informační lišta",
    description: "Čtyři stručné informace pod úvodní fotografií.",
    items: [
      item("home.facts.1.title", "1. nadpis"),
      item("home.facts.1.body", "1. popis"),
      item("home.facts.2.title", "2. nadpis"),
      item("home.facts.2.body", "2. popis"),
      item("home.facts.3.body", "3. popis"),
      item("home.facts.4.title", "4. nadpis"),
      item("home.facts.4.body", "4. popis"),
    ],
  },
  {
    title: "Jak to u nás funguje",
    description: "Nadpis a texty šesti kroků na úvodní stránce.",
    items: [
      item("home.about.title", "Nadpis sekce"),
      ...Array.from({ length: 6 }, (_, index) => {
        const number = index + 1;
        return [
          item(`home.about.step${number}.title`, `Krok ${number}: nadpis`),
          item(`home.about.step${number}.body`, `Krok ${number}: text`),
        ];
      }).flat(),
    ],
  },
  {
    title: "Ceník a rezervace",
    description: "Texty v cenové části a závěrečné výzvě k rezervaci.",
    items: [
      item("home.pricing.eyebrow", "Štítek ceníku"),
      item("home.pricing.title", "Nadpis ceníku (první dva řádky)"),
      item("home.pricing.titleAccent", "Zlatý třetí řádek nadpisu"),
      item("home.pricing.feature1", "Výhoda 1"),
      item("home.pricing.feature2", "Výhoda 2"),
      item("home.pricing.feature3", "Výhoda 3"),
      item("home.pricing.cardLabel", "Nadpis cenové karty"),
      item("home.pricing.button", "Tlačítko v cenové kartě"),
      item("home.cta.title", "Závěrečný nadpis"),
      item("home.cta.quote", "Citát pod závěrečným nadpisem"),
      item("home.cta.quoteAuthor", "Autor citátu"),
      item("home.cta.button", "Závěrečné tlačítko"),
    ],
  },
  {
    title: "Galerie",
    description: "Texty v sekci prostoru na úvodní stránce.",
    items: [
      item("home.gallery.eyebrow", "Štítek sekce"),
      item("home.gallery.title", "Nadpis"),
      item("home.gallery.mainImageAlt", "Popis hlavní fotografie"),
      item("home.gallery.image2", "Popis fotografie 2"),
      item("home.gallery.image3", "Popis fotografie 3"),
      item("home.gallery.image4", "Popis fotografie 4"),
      item("home.gallery.button", "Tlačítko"),
    ],
  },
  {
    title: "Vybavení",
    description: "Stránka Vybavení a popisy jednotlivých zón.",
    items: [
      item("equipment.eyebrow", "Štítek sekce"),
      item("equipment.title", "Hlavní nadpis"),
      item("equipment.imageAlt", "Popis hlavní fotografie"),
      item("equipment.zonesTitle", "Nadpis zón"),
      item("equipment.zonesIntro", "Úvodní text zón"),
      ...Array.from({ length: 6 }, (_, index) => {
        const number = index + 1;
        return [
          item(`equipment.zone${number}.title`, `Zóna ${number}: nadpis`),
          item(`equipment.zone${number}.body`, `Zóna ${number}: popis`),
        ];
      }).flat(),
    ],
  },
  {
    title: "FAQ",
    description: "Otázky a odpovědi na samostatné stránce FAQ.",
    items: [
      item("faq.title", "Hlavní nadpis"),
      ...FAQ_ITEMS,
      item("faq.cta", "Závěrečná výzva"),
      item("faq.ctaButton", "Tlačítko"),
    ],
  },
  {
    title: "Mapa a kontakt",
    description: "Kontaktní údaje, popisek mapy a sociální sítě.",
    items: [
      item("home.contact.title", "Nadpis kontaktu"),
      item("home.contact.mapHeading", "Nadpis v mapě"),
      item("home.contact.hours", "Text otevírací doby v mapě"),
      item("home.contact.mapsButton", "Tlačítko mapy"),
      item("contact.address", "Adresa"),
      item("contact.phone", "Telefon"),
      item("contact.email", "E-mail"),
      item("contact.facebook", "Odkaz na Facebook"),
      item("contact.instagram", "Odkaz na Instagram"),
    ],
  },
  {
    title: "Provozní řád",
    description: "Nadpis a text samostatné stránky provozního řádu.",
    items: [
      item("home.rules.title", "Nadpis"),
      item("home.rules.body", "Text provozního řádu"),
    ],
  },
];

export function isEditableContentKey(value: string): boolean {
  return CONTENT_EDITOR_SECTIONS.some((section) =>
    section.items.some((item) => item.key === value),
  );
}

export function getContentEditorItem(key: ContentEditorKey): {
  label: string;
  section: string;
} {
  for (const section of CONTENT_EDITOR_SECTIONS) {
    const found = section.items.find((item) => item.key === key);
    if (found) return { label: found.label, section: section.title };
  }
  return { label: key, section: "Ostatní" };
}
