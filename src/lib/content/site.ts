import { db } from "@/lib/db";
import { contentBlock, siteSetting } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/helpers/logger";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  ENTRY_PRICE_SETTING_KEY,
  FREE_ENTRY_EVERY,
} from "@/lib/config/pricing";
import {
  HERO_IMAGE_ALT_KEY,
  HERO_IMAGE_URL_KEY,
  SECTIONS_IMAGE_URL_KEY,
  LOGO_URL_KEY,
  TERMS_URL_KEY,
} from "@/lib/config/branding";

export const PUBLIC_ADDRESS = "Křížkova 424/23, Plzeň - Roudná";
export const PUBLIC_MAP_QUERY = "Křížkova 424/23, 301 00 Plzeň";

/** Keep the confirmed public label even when an older seeded CMS row exists. */
export function publicAddress(value?: string | null) {
  const address = value?.trim();
  if (!address || address.startsWith("Křížkova 424/23")) return PUBLIC_ADDRESS;
  return address;
}

/** Replace the old seeded placeholder with the profile confirmed by the client. */
function publicInstagram(value?: string | null) {
  const instagram = value?.trim();
  if (!instagram || instagram === "https://instagram.com")
    return SITE_DEFAULTS["contact.instagram"];
  return instagram;
}

/**
 * Public-site content, resilient by design. The marketing site reads copy from
 * the CMS (`content_block`), but must still render before the database is
 * provisioned or seeded : so this loader overlays any CMS values on top of
 * sensible Czech defaults and NEVER throws (a DB error falls back to defaults).
 *
 * Every key here is editable in the admin under "Obsah webu".
 */

export const SITE_DEFAULTS = {
  "brand.name": "NAMASTÉ Private Gym",
  "home.hero.badge": "Privátní fitness v Plzni",
  "home.hero.title": "Tvůj čas.\nTvůj prostor.\nTvoje",
  "home.hero.titleAccent": "Namasté.",
  "home.hero.subtitle":
    "Rezervujte si prémiové, soukromé, samoobslužné fitness v Plzni. Jen pro sebe a svůj doprovod.",
  "home.hero.primaryCta": "Vybrat termín",
  "home.hero.secondaryCta": "Jak rezervovat",
  "home.hero.addressLabel": "Adresa",
  "home.hero.hoursLabel": "Otevírací doba",
  "home.facts.1.title": "Samoobslužné fitness",
  "home.facts.1.body": "kardio, silová zóna a strečink",
  "home.facts.2.title": "Dětský koutek",
  "home.facts.2.body": "plně vybavený s pískovištěm",
  "home.facts.3.body": "otevřeno každý den",
  "home.facts.4.title": "Komfortní zázemí",
  "home.facts.4.body": "plná lednice, relax zóna",
  "home.about.title": "Jak to u nás funguje",
  "home.about.step1.title": "Vyber si termín",
  "home.about.step1.body":
    "V rezervačním systému si vyber termín a časové okno, ve kterém chceš přijít zacvičit si. Potvrď, že ses seznámil s naším provozním řádem a obchodními podmínkami, a vyplň rezervaci.",
  "home.about.step2.title": "Po zaplacení",
  "home.about.step2.body":
    "Ti přijde společně s potvrzením tvojí rezervace veškeré potřebné info ke vstupu do našeho gymu do e-mailu, který jsi zadal při rezervaci.",
  "home.about.step3.title": "Vstup do fitka",
  "home.about.step3.body":
    "Před začátkem tvé rezervace ti přijde do e-mailu a SMS unikátní kód, který zadáš na klávesnici u vstupu do fitness a dveře se ti odemknou. Kód platí pouze v tvém vybraném časovém okně.",
  "home.about.step4.title": "Zacvič si",
  "home.about.step4.body":
    "Po celou dobu tvého tréninku můžeš prostory využívat plně dle svého uvážení. Veškeré stroje a pomůcky jsou ti k dispozici. Pokud si nevíš rady, využij našeho videopomocníka nebo oslov třeba našeho trenéra.",
  "home.about.step5.title": "Úklid",
  "home.about.step5.body":
    "Po tréninku nezapomeň vše po sobě vrátit na své místo a do původního stavu, aby mohl další klient využít vše stejně jako ty. Nezapomeň zkontrolovat i dětský koutek a zahrádku, pokud jsi je využíval. Moc ti za to děkujeme.",
  "home.about.step6.title": "Před odchodem",
  "home.about.step6.body":
    "Můžeš využít koupelnu, kde najdeš sprchu včetně české přírodní kosmetiky. V automatu si můžeš zakoupit své oblíbené suplementy nebo svačinu. Nezapomeň se vyfotit a označit nás na sociálních sítích nebo nás ohodnotit. Budeme se těšit na příště.",
  "home.pricing.eyebrow": "Ceník",
  "home.pricing.title": "Jednorázový vstup bez předplatného",
  "home.pricing.note":
    "Bez závazků a měsíčních plateb. Platíte jen za to, co si odtrénujete.",
  "home.pricing.feature1": "Soukromé využití prostoru během rezervace",
  "home.pricing.feature2": "Platba online kartou",
  "home.pricing.feature3": "Pokyny ke vstupu po potvrzení rezervace",
  "home.pricing.cardLabel": "Jednorázový vstup",
  "home.pricing.button": "Rezervovat trénink",
  "home.gallery.eyebrow": "Prostor",
  "home.cta.title": "Připravený na změnu? Přidej se k nám!",
  "home.cta.quote":
    "To keep the body in good health is a duty... otherwise we shall not be able to keep our mind strong and clear.",
  "home.cta.quoteAuthor": "Buddha",
  "home.cta.button": "Rezervovat",
  "home.rules.title": "Provozní řád",
  "home.rules.body":
    "Do fitness vstupujte pouze v čase rezervace. Po tréninku vraťte vybavení do původního stavu a otřete použité nářadí. Vstupní kód je osobní a platí pouze podle pokynů k vaší rezervaci.",
  "home.gallery.title": "Podívejte se dovnitř",
  "home.gallery.mainImageAlt": "Interiér NAMASTÉ Private Gym",
  "home.gallery.image2": "Další pohled na prostor",
  "home.gallery.image3": "Detail tréninkové zóny",
  "home.gallery.image4": "Zázemí a vstup",
  "home.gallery.button": "Informace o vybavení",
  "home.contact.title": "Kontakt",
  "home.contact.mapHeading": "NAMASTÉ Private Gym",
  "home.contact.hours": "Otevírací doba {hours}, každý den",
  "home.contact.mapsButton": "Otevřít v Mapách Google",
  "contact.address": PUBLIC_ADDRESS,
  // PLACEHOLDERS supplied by the client for layout purposes. These are not the
  // real contact details : replace them in the admin before launch.
  "contact.phone": "777 666 555",
  "contact.email": "info@namastegym.cz",
  // Facebook remains a layout placeholder until the client supplies the page.
  "contact.facebook": "https://facebook.com",
  "contact.instagram": "https://instagram.com/namaste_plzen",
  "equipment.eyebrow": "Prostor",
  "equipment.title": "Vybavení a prostor",
  "equipment.imageAlt": "Interiér NAMASTÉ Private Gym",
  "equipment.zonesTitle": "Jednotlivé zóny",
  "equipment.zonesIntro":
    "Fotografie jednotlivých zón doplní provozovatel v administraci.",
  "equipment.zone1.title": "Silová zóna",
  "equipment.zone1.body":
    "Stroje a pomůcky pro silový trénink máte po celou dobu rezervace jen pro sebe.",
  "equipment.zone2.title": "Kardio zóna",
  "equipment.zone2.body":
    "Prostor pro rozehřátí i vytrvalostní trénink ve vlastním tempu.",
  "equipment.zone3.title": "Strečink zóna",
  "equipment.zone3.body":
    "Místo na protažení, mobilitu a zklidnění po tréninku.",
  "equipment.zone4.title": "Zázemí pro děti",
  "equipment.zone4.body":
    "Plně vybavený dětský koutek s pískovištěm a zahrádkou.",
  "equipment.zone5.title": "Vybavená lednice",
  "equipment.zone5.body":
    "Plná lednice a automat se svačinou i oblíbenými suplementy.",
  "equipment.zone6.title": "Zázemí pro vás",
  "equipment.zone6.body":
    "Relax zóna a koupelna se sprchou včetně české přírodní kosmetiky.",
  "faq.title": "Často kladené otázky",
  "faq.cta": "Vyberte datum a volný čas.",
  "faq.ctaButton": "Otevřít kalendář",
  "faq.1.question": "Jak se k nám dostanete?",
  "faq.1.answer":
    "Najdete nás na adrese Křížkova 424/23, Plzeň - Roudná. Můžete k nám pohodlně přijet autem. Autobusová zastávka Rondel je vzdálená přibližně 300 metrů.",
  "faq.2.question": "Dá se u vás zaparkovat?",
  "faq.2.answer":
    "Ano, přímo před studiem je k dispozici dostatek parkovacích míst.",
  "faq.3.question": "Jsem začátečník, mohu si vaše studio pronajmout?",
  "faq.3.answer":
    "Samozřejmě. Studio je navrženo pro každého, od úplných začátečníků po zkušené sportovce. Pokud si nebudete vědět rady s ovládáním strojů, můžete přijít s vlastním trenérem nebo později využít připravovaného videorádce.",
  "faq.4.question": "Je vstup do studia omezen věkem?",
  "faq.4.answer":
    "Ano, rezervaci může vytvořit pouze osoba starší 18 let. V jejím doprovodu však mohou přijít také děti nebo mladiství.",
  "faq.5.question": "Mohu přijít i s dětmi?",
  "faq.5.answer":
    "Ano. Pro děti je připraven vybavený vnitřní dětský koutek a venkovní pískoviště. Za přítomnost dětí a jejich bezpečnost nese plnou odpovědnost jejich doprovod. Dětem je z bezpečnostních důvodů přísně zakázáno používat cvičební stroje.",
  "faq.6.question":
    "Kolik lidí může přijít na jednu rezervaci? Budou tam další osoby?",
  "faq.6.answer":
    "Nebudou. Celý prostor je ve vašem časovém okně rezervován exkluzivně pro vás a váš doprovod. Nikdo cizí se v prostoru pohybovat nebude. Maximální kapacita je 5 osob včetně dětí.",
  "faq.7.question": "Budu platit více, když do studia nepůjdu sám nebo sama?",
  "faq.7.answer":
    "Ne. Cena je jednotná a bez příplatků. Za 75 minut zaplatíte 290 Kč, a to až pro 5 osob. Při návštěvě v pěti vychází rezervace jednoho člověka na 58 Kč.",
  "faq.8.question": "Jak se dostanu dovnitř? Bude na místě recepce?",
  "faq.8.answer":
    "Fungujeme jako plně samoobslužné studio, takže u nás klasickou recepci nenajdete. Před rezervovaným časem obdržíte číselný kód. Zadáte ho u vstupu a dveře se automaticky odemknou.",
  "faq.9.question": "Co když přijdu později?",
  "faq.9.answer":
    "Nevadí. Vstupní kód je platný po celou dobu rezervovaného časového okna. Pozdním příchodem se však připravujete o část zaplaceného času.",
  "faq.10.question": "Nemohu se do studia dostat. Co mám dělat?",
  "faq.10.answer":
    "Ihned zavolejte na telefonní číslo uvedené v kontaktech. Problém vyřešíme na dálku.",
  "faq.11.question": "Jaké jsou způsoby platby?",
  "faq.11.answer":
    "Platba probíhá bezpečně online přes integrovanou platební bránu Stripe. Zaplatit můžete platební kartou, přes Google Pay nebo Apple Pay.",
  "faq.12.question": "Je možné rezervaci stornovat?",
  "faq.12.answer":
    "Ano. Bezplatné storno nebo změnu termínu lze provést nejpozději 24 hodin před začátkem rezervace.",
  "faq.13.question": "Jaká je otevírací doba Namasté Private Gym?",
  "faq.13.answer": "Otevřeno máme každý den od 5:00 do 23:45.",
  "faq.14.question": "Jak je ve studiu řešena bezpečnost?",
  "faq.14.answer":
    "Prostor je vybaven řádně označenými únikovými východy, hasicími přístroji a lékárničkou. Z bezpečnostních a ochranných důvodů je celý prostor monitorován kamerovým systémem.",
  "faq.15.question": "Jaké vybavení u vás najdu?",
  "faq.15.answer":
    "Přesný seznam cvičebních strojů a pomůcek najdete na stránce Vybavení. Vedle fitness zóny je k dispozici dětský koutek, malá zahrádka s pískovištěm, relaxační zóna, koupelna se sprchou a WC a lednice s nápoji a drobným občerstvením.",
  "faq.16.question": "Je občerstvení v lednici zdarma?",
  "faq.16.answer":
    "Není. Za produkty z lednice zaplatíte pomocí QR kódu přes bankovní aplikaci. Ceník i QR kód najdete na viditelném místě přímo na lednici.",
  "faq.17.question": "Nabízíte služby osobního trenéra?",
  "faq.17.answer":
    "Vlastní trenéry stabilně nezaměstnáváme, ale spolupracujeme s několika plzeňskými trenéry, kteří studio pravidelně využívají. Pokud máte zájem, rádi vás s nimi propojíme.",
  "faq.18.question":
    "Jak často se prostor uklízí a co dělat, když najdu nepořádek?",
  "faq.18.answer":
    "Prostor je pravidelně profesionálně uklízen. Pokud při příchodu zjistíte znečištění nebo poškození vybavení, ihned nás kontaktujte. Děkujeme, že nám pomáháte udržovat Namasté čisté.",
  "faq.19.question": "Mohu si ve studiu natáčet videa nebo fotografovat?",
  "faq.19.answer":
    "Ano. Budeme rádi, když své momenty z tréninku zaznamenáte a označíte nás na Instagramu jako @namaste_plzen.",
  "faq.20.question": "Je možné si ke cvičení pustit vlastní hudbu?",
  "faq.20.answer":
    "Ano. Ve studiu je reproduktor, ke kterému se připojíte přes Bluetooth. Protože jsou nad studiem byty, pouštějte hudbu ohleduplně. Od 22:00 do 6:00 je používání reproduktoru kvůli nočnímu klidu zakázáno.",
} as const;

/**
 * Early seed values that were intentionally superseded by the client-approved
 * hero. Ignore only these exact values so an administrator's own edit always
 * wins, while the editor and public page start from the currently published
 * copy instead of reverting during this migration.
 */
const LEGACY_CONTENT_VALUES: Partial<
  Record<keyof typeof SITE_DEFAULTS, string>
> = {
  "home.hero.title": "Tvůj čas. Tvůj prostor. Tvoje Namasté.",
  "home.hero.subtitle":
    "Rezervujte si celé samoobslužné fitness v Plzni jen pro sebe a svůj doprovod.",
};

export type SiteContentKey = keyof typeof SITE_DEFAULTS;

export interface SiteContent {
  get: (key: SiteContentKey) => string;
  entryPriceCents: number;
  freeEntryEvery: number;
  logoUrl: string | null;
  termsUrl: string | null;
  heroImageUrl: string | null;
  heroImageAlt: string;
  /** Photograph pinned behind the operating-steps and pricing bands. */
  sectionsImageUrl: string | null;
}

/** Props every public page hands to `SiteFooter`, derived from CMS content. */
export function footerProps(content: SiteContent) {
  return {
    brand: content.get("brand.name"),
    email: content.get("contact.email").trim() || undefined,
    phone: content.get("contact.phone").trim() || undefined,
    address: publicAddress(content.get("contact.address")),
    facebookUrl: content.get("contact.facebook").trim() || undefined,
    instagramUrl: publicInstagram(content.get("contact.instagram")),
    termsUrl: content.termsUrl,
  };
}

/** Load all public content once (overlay CMS values on defaults). Never throws. */
export async function loadSiteContent(locale = "cs"): Promise<SiteContent> {
  const values: Record<string, string> = { ...SITE_DEFAULTS };
  let entryPriceCents = DEFAULT_ENTRY_PRICE_CENTS;
  let logoUrl: string | null = null;
  let termsUrl: string | null = null;
  let heroImageUrl: string | null = null;
  let heroImageAlt = "";
  let sectionsImageUrl: string | null = null;

  try {
    const rows = await db
      .select({ key: contentBlock.key, valueText: contentBlock.valueText })
      .from(contentBlock)
      .where(eq(contentBlock.locale, locale));
    for (const row of rows) {
      if (
        row.valueText != null &&
        row.valueText !== "" &&
        LEGACY_CONTENT_VALUES[row.key as SiteContentKey] !== row.valueText
      )
        values[row.key] = row.valueText;
    }

    const settings = await db
      .select({ key: siteSetting.key, value: siteSetting.value })
      .from(siteSetting);
    for (const s of settings) {
      if (s.key === ENTRY_PRICE_SETTING_KEY && typeof s.value === "number")
        entryPriceCents = s.value;
      if (s.key === LOGO_URL_KEY && typeof s.value === "string")
        logoUrl = s.value || null;
      if (s.key === TERMS_URL_KEY && typeof s.value === "string")
        termsUrl = s.value || null;
      if (s.key === HERO_IMAGE_URL_KEY && typeof s.value === "string")
        heroImageUrl = s.value || null;
      if (s.key === HERO_IMAGE_ALT_KEY && typeof s.value === "string")
        heroImageAlt = s.value;
      if (s.key === SECTIONS_IMAGE_URL_KEY && typeof s.value === "string")
        sectionsImageUrl = s.value || null;
    }
  } catch (e) {
    // DB not provisioned/reachable yet : fall back to defaults so the public
    // site still renders on a fresh deploy.
    logger.warn("loadSiteContent: using defaults (DB unavailable)", {
      error: String(e),
    });
  }

  return {
    get: (key) => values[key] ?? SITE_DEFAULTS[key] ?? "",
    entryPriceCents,
    freeEntryEvery: FREE_ENTRY_EVERY,
    logoUrl,
    termsUrl,
    heroImageUrl,
    heroImageAlt,
    sectionsImageUrl,
  };
}
