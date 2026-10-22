import {
  GALLERY_IMAGE_URL_KEYS,
  HERO_IMAGE_ALT_KEY,
  HERO_IMAGE_URL_KEY,
  SECTIONS_IMAGE_URL_KEY,
  zoneImageUrlKey,
} from "@/lib/config/branding";
export interface ContentDependency {
  label: string;
  description: string;
  href: string;
  linkLabel: string;
}
export interface ContentAsset {
  key: string;
  label: string;
  kind: "image" | "text";
}
export interface ContentVisual {
  id: string;
  href: string;
  dependencies: ContentDependency[];
  assets: ContentAsset[];
}
const prices: ContentDependency = {
  label: "Cena vstupu a doprovodu",
  description:
    "Částku nelze přepsat jako text. Počítá se podle data návštěvy, cenových období a cen bloků.",
  href: "/admin/memberships",
  linkLabel: "Otevřít Ceník a doprovod",
};
const hours: ContentDependency = {
  label: "Otevírací doba a délka bloků",
  description: "Termíny kalendáře vycházejí z nastaveného rozvrhu.",
  href: "/admin/schedule",
  linkLabel: "Otevřít otevírací dobu a bloky",
};
const photos = (keys: readonly string[], label: string): ContentAsset[] =>
  keys.map((key, index) => ({
    key,
    label: `${label} ${index + 1}`,
    kind: "image",
  }));
export const CONTENT_VISUALS: Record<string, ContentVisual> = {
  Hero: {
    id: "hero",
    href: "/",
    dependencies: [
      prices,
      hours,
      {
        label: "Adresa",
        description: "Stejná adresa se používá v úvodu, mapě i patičce.",
        href: "/admin/content?section=contact",
        linkLabel: "Upravit kontaktní údaje",
      },
    ],
    assets: [
      {
        key: HERO_IMAGE_URL_KEY,
        label: "Úvodní fotografie na počítači",
        kind: "image",
      },
      {
        key: zoneImageUrlKey(1),
        label: "Úvodní fotografie na mobilu / silová zóna",
        kind: "image",
      },
      {
        key: HERO_IMAGE_ALT_KEY,
        label: "Popis úvodní fotografie pro čtečky",
        kind: "text",
      },
    ],
  },
  "Informační lišta": {
    id: "facts",
    href: "/#informace",
    dependencies: [hours],
    assets: [],
  },
  "Jak to u nás funguje": {
    id: "steps",
    href: "/#jak-to-funguje",
    dependencies: [],
    assets: [
      {
        key: SECTIONS_IMAGE_URL_KEY,
        label: "Fotografie na pozadí kroků a ceníku",
        kind: "image",
      },
    ],
  },
  "Ceník a rezervace": {
    id: "pricing",
    href: "/#cenik",
    dependencies: [
      prices,
      hours,
      {
        label: "Věrnostní vstup",
        description:
          "Každý desátý vstup registrovaného zákazníka je zdarma. Jde o pravidlo systému, ne o editovatelnou cenu.",
        href: "/admin/how-it-works",
        linkLabel: "Jak fungují rezervace a věrnost",
      },
      {
        label: "Obsazené termíny",
        description:
          "Kalendář respektuje rezervace a blokované termíny. Úprava těchto textů jejich stav nemění.",
        href: "/admin/blocking",
        linkLabel: "Otevřít blokování termínů",
      },
    ],
    assets: [
      {
        key: SECTIONS_IMAGE_URL_KEY,
        label: "Fotografie na pozadí ceníku a kroků",
        kind: "image",
      },
    ],
  },
  Galerie: {
    id: "gallery",
    href: "/#prostor",
    dependencies: [
      {
        label: "Sdílená fotografie vybavení",
        description:
          "Jeden snímek galerie se používá také u zóny s občerstvením.",
        href: "/admin/content?section=equipment",
        linkLabel: "Upravit vybavení",
      },
    ],
    assets: photos(GALLERY_IMAGE_URL_KEYS, "Fotografie galerie"),
  },
  Vybavení: {
    id: "equipment",
    href: "/vybaveni",
    dependencies: [],
    assets: photos(
      Array.from({ length: 6 }, (_, i) => zoneImageUrlKey(i + 1)),
      "Fotografie zóny",
    ),
  },
  FAQ: { id: "faq", href: "/faq", dependencies: [prices, hours], assets: [] },
  Instagram: {
    id: "instagram",
    href: "/#instagram",
    dependencies: [],
    assets: [],
  },
  "Mapa a kontakt": {
    id: "contact",
    href: "/#kontakt",
    dependencies: [hours],
    assets: [],
  },
  "Provozní řád": {
    id: "rules",
    href: "/provozni-rad",
    dependencies: [
      {
        label: "Obchodní podmínky a ostatní právní dokumenty",
        description:
          "Tato část upravuje pouze provozní řád. Ostatní právní dokumenty mají samostatný obsah; nejsou nahrazovány marketingovými texty.",
        href: "/admin/settings#branding",
        linkLabel: "Otevřít nastavení dokumentů",
      },
    ],
    assets: [],
  },
  "Newsletter a patička": {
    id: "newsletter",
    href: "/#novinky",
    dependencies: [
      {
        label: "Kontakty a sociální sítě v patičce",
        description:
          "Telefon, e-mail, adresa a odkazy na sociální sítě se přebírají ze společných kontaktů.",
        href: "/admin/content?section=contact",
        linkLabel: "Upravit kontakty a sociální sítě",
      },
      {
        label: "Odběratelé novinek",
        description:
          "Úprava textů tohoto formuláře nic nerozesílá. Seznam odběratelů je veden samostatně.",
        href: "/admin/newsletter",
        linkLabel: "Otevřít odběratele novinek",
      },
    ],
    assets: [],
  },
  "Oznamovací lišta": {
    id: "opening",
    href: "/",
    dependencies: [
      {
        label: "Ceny uvedené v oznámení",
        description:
          "Lišta používá vámi uložený text, dokud jej nezměníte nebo lištu nevypnete. Pokud v textu uvedete cenu, upravte ji i zde; nastavení lišty cenu rezervace nemění.",
        href: "/admin/memberships",
        linkLabel: "Zkontrolovat skutečné ceny",
      },
    ],
    assets: [],
  },
};
export const CONTENT_ASSETS = Object.values(CONTENT_VISUALS).flatMap(
  (section) => section.assets,
);
export function getContentAsset(key: string) {
  return CONTENT_ASSETS.find((asset) => asset.key === key);
}
