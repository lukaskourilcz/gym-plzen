import type { Metadata } from "next";
import { footerProps, loadSiteContent } from "@/lib/content/site";
import { Container, Section } from "@/components/ui/container";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";

export const metadata: Metadata = {
  title: "Ochrana soukromí a osobních údajů",
  description:
    "Zásady zpracování osobních údajů, používání cookies a přehled práv návštěvníků a klientů NAVI Private Gym.",
  alternates: { canonical: "/ochrana-soukromi" },
};

const sections = [
  ["spravci", "Správci a kontakt"],
  ["udaje", "Jaké údaje zpracováváme"],
  ["ucely", "Účely a právní základy"],
  ["rezervace", "Rezervace, platby a vstup"],
  ["kamery", "Kamerový systém"],
  ["prijemci", "Příjemci a předávání údajů"],
  ["uchovani", "Doba uchování"],
  ["cookies", "Cookies a obdobné technologie"],
  ["externi", "Externí služby na webu"],
  ["prava", "Vaše práva"],
  ["dalsi", "Další informace"],
] as const;

function PolicySection({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-28 border-t border-border py-10 first:border-t-0 first:pt-0 sm:py-12"
    >
      <div className="grid gap-2 sm:grid-cols-[3rem_minmax(0,1fr)] sm:gap-4">
        <span
          aria-hidden="true"
          className="text-sm font-extrabold text-accent-foreground sm:pt-2"
        >
          {String(number).padStart(2, "0")}
        </span>
        <h2
          id={`${id}-title`}
          className="text-2xl font-extrabold leading-tight tracking-[-.01em] sm:text-3xl"
        >
          {title}
        </h2>
      </div>
      <div className="mt-7 space-y-5 leading-7 text-muted-foreground sm:ml-16">
        {children}
      </div>
    </section>
  );
}

const strong = "font-extrabold text-foreground";
const link =
  "font-bold text-accent-foreground underline decoration-current/40 underline-offset-4 hover:decoration-current";

export default async function PrivacyPage() {
  const content = await loadSiteContent();
  const contactEmail = content.get("contact.email");

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="pb-12 pt-14 sm:pb-16 sm:pt-20">
          <Container>
            <div className="max-w-3xl">
              <p className="text-xs font-extrabold uppercase tracking-[.14em] text-accent-foreground">
                Informace podle GDPR
              </p>
              <h1 className="mt-3 text-4xl font-extrabold tracking-[-.01em] sm:text-5xl lg:text-6xl">
                Zásady ochrany osobních údajů
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
                Vysvětlujeme zde, jak NAVI zpracovává osobní údaje při návštěvě
                webu, rezervaci a užívání samoobslužného studia.
              </p>
              <div className="mt-8 border-y border-border py-4 text-sm leading-6">
                Platnost a účinnost od: 17. 8. 2026
              </div>
            </div>
          </Container>
        </Section>

        <Section className="border-t border-border bg-card py-12 sm:py-16">
          <Container className="lg:grid lg:grid-cols-[15rem_minmax(0,45rem)] lg:items-start lg:gap-16">
            <nav
              aria-label="Obsah zásad ochrany osobních údajů"
              className="border-b border-border pb-8 lg:sticky lg:top-28 lg:border-b-0 lg:pb-0"
            >
              <h2 className="text-sm font-extrabold uppercase tracking-[.1em] text-accent-foreground">
                Obsah dokumentu
              </h2>
              <ol className="mt-3 grid sm:grid-cols-2 sm:gap-x-6 lg:grid-cols-1 lg:gap-x-0">
                {sections.map(([id, title], index) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="flex min-h-11 items-center border-t border-border/70 py-2 text-sm font-bold leading-5 transition-colors hover:text-accent-foreground"
                    >
                      <span className="mr-3 text-accent-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>

            <article className="mt-10 min-w-0 lg:mt-0">
              <PolicySection id="spravci" number={1} title="Správci a kontakt">
                <p>
                  Správci osobních údajů pro společný provoz studia NAVI jsou:
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <address className="not-italic rounded-lg border border-border bg-background p-5">
                    <strong className={strong}>Klára Bílková</strong>
                    <br />
                    IČO: 22209417
                    <br />
                    sídlo: Jarov 68, 331 51
                  </address>
                  <address className="not-italic rounded-lg border border-border bg-background p-5">
                    <strong className={strong}>Renáta Janoušková</strong>
                    <br />
                    IČO: 29619998
                    <br />
                    sídlo: Úhlavská 546/2, 326 00 Plzeň – Doudlevce
                  </address>
                </div>
                <p>
                  Poskytovatelem rezervované služby, příjemcem plateb a osobou
                  vystavující účetní a daňové doklady je Renáta Janoušková.
                  Otázky a žádosti týkající se osobních údajů můžete poslat na
                  společnou kontaktní adresu{" "}
                  <a className={link} href={`mailto:${contactEmail}`}>
                    {contactEmail}
                  </a>
                  . Žádost můžete uplatnit vůči kterékoli ze správců.
                </p>
              </PolicySection>

              <PolicySection
                id="udaje"
                number={2}
                title="Jaké údaje zpracováváme"
              >
                <ul className="grid gap-3 pl-5 marker:text-accent-foreground">
                  <li>
                    <strong className={strong}>
                      Identifikační a kontaktní údaje
                    </strong>{" "}
                    – zejména jméno, e-mail, telefon a identifikátor účtu.
                  </li>
                  <li>
                    <strong className={strong}>
                      Údaje o rezervaci a smlouvě
                    </strong>{" "}
                    – zvolený termín, stav rezervace, cena, uplatněné výhody,
                    přijetí provozního řádu a obchodních podmínek, změny, storna
                    a související komunikace.
                  </li>
                  <li>
                    <strong className={strong}>Platební a účetní údaje</strong>{" "}
                    – částka, měna, stav platby a identifikátory zákazníka,
                    platební relace, předplatného nebo dokladu. Údaje platební
                    karty zadáváte přímo společnosti Comgate; NAVI je nezískává
                    ani neukládá.
                  </li>
                  <li>
                    <strong className={strong}>
                      Údaje o vstupu a bezpečnosti
                    </strong>{" "}
                    – platnost přístupového kódu, jeho hash a poslední dvě
                    číslice, identifikátory elektronického zámku, čas a způsob
                    odemknutí, provozní záznamy a kamerové záznamy.
                  </li>
                  <li>
                    <strong className={strong}>Komunikace a nastavení</strong> –
                    doručovací kanál, stav doručení e-mailu, WhatsAppu nebo SMS,
                    poskytovatelem přidělené ID zprávy, požadavky na podporu,
                    preference a záznam udělení či odvolání souhlasu.
                  </li>
                  <li>
                    <strong className={strong}>Technické údaje</strong> – IP
                    adresa, údaje o zařízení, prohlížeči a operačním systému,
                    navštívená stránka, čas požadavku, referrer, diagnostické a
                    bezpečnostní záznamy a pseudonymní identifikátory cookies.
                  </li>
                </ul>
                <p>
                  Údaje získáváme přímo od vás, při používání webu a studia a od
                  zapojených poskytovatelů, například potvrzení platby od
                  Comgate nebo událost od elektronického zámku Nuki.
                </p>
              </PolicySection>

              <PolicySection
                id="ucely"
                number={3}
                title="Účely a právní základy"
              >
                <div className="grid gap-4">
                  {[
                    {
                      title: "Účet, rezervace a poskytnutí služby",
                      body: "Uzavření a plnění smlouvy, správa účtu, platba, potvrzení rezervace, předání vstupního kódu a vyřízení změn, storna, reklamace nebo podpory.",
                      basis: "čl. 6 odst. 1 písm. b) GDPR",
                    },
                    {
                      title: "Účetnictví a právní povinnosti",
                      body: "Vystavení a uchování účetních či daňových dokladů, splnění povinností vůči orgánům veřejné moci a součinnost podle právních předpisů.",
                      basis: "čl. 6 odst. 1 písm. c) GDPR",
                    },
                    {
                      title: "Bezpečnost, ochrana majetku a právních nároků",
                      body: "Ochrana osob a studia, kontrola oprávněných vstupů, prevence zneužití, řešení incidentů a prokazování či obhajoba právních nároků.",
                      basis: "čl. 6 odst. 1 písm. f) GDPR",
                    },
                    {
                      title: "Bezpečný a spolehlivý provoz webu",
                      body: "Zajištění funkčnosti, zabezpečení, prevence útoků, diagnostika chyb a základní souhrnné vyhodnocení výkonu webu.",
                      basis: "čl. 6 odst. 1 písm. f) GDPR",
                    },
                    {
                      title: "Volitelná analytika a měření reklamy",
                      body: "Google Analytics 4 a Meta Pixel se spustí jen na základě vaší volby v nastavení cookies.",
                      basis:
                        "souhlas podle čl. 6 odst. 1 písm. a) GDPR a § 89 odst. 3 zákona č. 127/2005 Sb.",
                    },
                    {
                      title: "Obchodní sdělení",
                      body: "Marketingové e-maily nebo zprávy posíláme jen osobám, které k tomu udělily souhlas; souhlas lze kdykoliv odvolat.",
                      basis:
                        "čl. 6 odst. 1 písm. a) GDPR a zákon č. 480/2004 Sb.",
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="rounded-lg border border-border bg-background p-5"
                    >
                      <h3 className="font-extrabold text-foreground">
                        {item.title}
                      </h3>
                      <p className="mt-2">{item.body}</p>
                      <p className="mt-2 text-sm">
                        <strong className={strong}>Právní základ:</strong>{" "}
                        {item.basis}
                      </p>
                    </div>
                  ))}
                </div>
                <p>
                  Našimi oprávněnými zájmy jsou bezpečný a hospodárný provoz
                  webu a samoobslužného studia, ochrana osob a majetku, prevence
                  podvodů a ochrana právních nároků. Proti zpracování založenému
                  na oprávněném zájmu můžete vznést námitku.
                </p>
              </PolicySection>

              <PolicySection
                id="rezervace"
                number={4}
                title="Rezervace, platby a vstup"
              >
                <p>
                  Údaje označené v rezervačním nebo registračním formuláři jako
                  povinné potřebujeme k uzavření smlouvy, přijetí platby,
                  doručení potvrzení a bezpečnému zpřístupnění studia. Bez nich
                  rezervaci zpravidla nelze dokončit. Vytvoření účtu je
                  dobrovolné, pokud web u konkrétní služby umožňuje rezervaci
                  hosta.
                </p>
                <p>
                  Přístupový PIN je po vytvoření předán zvoleným komunikačním
                  kanálem. V databázi uchováváme pouze jeho jednosměrný hash a
                  poslední dvě číslice pro podporu; celý PIN z databáze nelze
                  zpětně přečíst. Elektronický zámek zaznamenává čas a způsob
                  skutečného vstupu, abychom mohli ověřit oprávněné použití a
                  řešit bezpečnostní události.
                </p>
              </PolicySection>

              <PolicySection id="kamery" number={5} title="Kamerový systém">
                <p>
                  Vybrané části studia jsou monitorovány kamerovým systémem se
                  záznamem za účelem ochrany osob, majetku a vybavení a kontroly
                  neoprávněného vstupu. Právním základem je oprávněný zájem
                  správců podle čl. 6 odst. 1 písm. f) GDPR. Kamery nejsou
                  umístěny na WC, ve sprše ani v jiném prostoru, kde by záznam
                  nepřiměřeně zasahoval do soukromí.
                </p>
                <p>
                  Prostory pod dohledem jsou označeny před vstupem. K záznamům
                  mají přístup pouze oprávněné osoby a případně smluvní správce
                  kamerového systému. Záznamy se uchovávají jen po nezbytně
                  krátkou dobu potřebnou k prověření bezpečnostních událostí.
                  Pokud zachycují konkrétní incident, může být příslušný výřez
                  uchován do jeho vyřešení a vypořádání navazujících právních
                  nároků nebo předán policii, soudu, pojišťovně či jinému
                  oprávněnému orgánu.
                </p>
              </PolicySection>

              <PolicySection
                id="prijemci"
                number={6}
                title="Příjemci a předávání údajů"
              >
                <p>
                  Údaje zpřístupňujeme pouze v nezbytném rozsahu správcům a
                  oprávněným pracovníkům a následujícím kategoriím příjemců:
                </p>
                <ul className="grid gap-3 pl-5 marker:text-accent-foreground">
                  <li>
                    poskytovatelům hostingu, databáze, autentizace a úložiště
                    (Vercel a Supabase),
                  </li>
                  <li>
                    poskytovateli platební brány a zpracování plateb (Comgate),
                  </li>
                  <li>
                    poskytovatelům e-mailů, WhatsApp zpráv a volitelných SMS
                    (Resend, Meta a GoSMS),
                  </li>
                  <li>
                    poskytovateli elektronického zámku a správy přístupů (Nuki),
                  </li>
                  <li>
                    poskytovatelům analytiky, map, měření reklamy a diagnostiky
                    (Google, Meta, Vercel a při aktivaci Sentry),
                  </li>
                  <li>
                    účetním, právním a technickým poradcům, pojišťovnám a
                    orgánům veřejné moci, pokud to vyžaduje zákon nebo ochrana
                    našich práv.
                  </li>
                </ul>
                <p>
                  Někteří poskytovatelé působí mimo Evropský hospodářský prostor
                  nebo využívají infrastrukturu ve třetích zemích. K předání
                  dochází pouze při splnění podmínek kapitoly V GDPR, zejména na
                  základě rozhodnutí Evropské komise o odpovídající ochraně nebo
                  standardních smluvních doložek podle čl. 46 GDPR a
                  doplňujících bezpečnostních opatření. Konkrétní informace a
                  kopii použitých záruk si můžete vyžádat na kontaktním e-mailu.
                </p>
              </PolicySection>

              <PolicySection id="uchovani" number={7} title="Doba uchování">
                <p>
                  Údaje uchováváme jen po dobu potřebnou pro daný účel. Délku
                  určujeme podle trvání smluvního vztahu, zákonných archivačních
                  povinností, promlčecích lhůt, potřeby řešit incident nebo
                  právní nárok a nastavení příslušné služby:
                </p>
                <ul className="grid gap-3 pl-5 marker:text-accent-foreground">
                  <li>
                    účet a profil po dobu registrace a následně po dobu nutnou k
                    vypořádání povinností a právních nároků,
                  </li>
                  <li>
                    rezervace, platby, související komunikace a doklady po dobu
                    smluvního vztahu a poté po zákonem stanovenou nebo promlčecí
                    dobu; účetní a daňové doklady podle příslušných účetních a
                    daňových předpisů,
                  </li>
                  <li>
                    záznamy vstupů, provozní a bezpečnostní logy po dobu
                    nezbytnou pro bezpečnost, podporu, audit a ochranu právních
                    nároků,
                  </li>
                  <li>
                    marketingový souhlas do jeho odvolání; omezený doklad o
                    udělení nebo odvolání můžeme uchovat po dobu nutnou k
                    prokázání splnění právních povinností,
                  </li>
                  <li>
                    údaje v zálohách do jejich pravidelného přepsání podle
                    zálohovacího cyklu; po dobu zálohy je dále aktivně
                    nezpracováváme, není-li obnova nutná.
                  </li>
                </ul>
                <p>Pro kamerové záznamy platí zvláštní pravidla v bodu 5.</p>
              </PolicySection>

              <PolicySection
                id="cookies"
                number={8}
                title="Cookies a obdobné technologie"
              >
                <p>
                  Nezbytné cookies a lokální úložiště používáme pro přihlášení,
                  bezpečnost a uložení vašeho nastavení. Analytické a
                  marketingové technologie jsou ve výchozím stavu vypnuté a
                  spustí se až po aktivním souhlasu. Odmítnutí je stejně snadné
                  jako přijetí a nemá vliv na možnost rezervovat studio.
                </p>
                <div className="overflow-x-auto rounded-lg border border-border bg-background">
                  <table className="w-full min-w-[42rem] border-collapse text-left text-sm leading-6">
                    <thead className="bg-muted/50 text-foreground">
                      <tr>
                        <th className="p-4 font-extrabold">Název / služba</th>
                        <th className="p-4 font-extrabold">Účel</th>
                        <th className="p-4 font-extrabold">Kategorie a doba</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      <tr>
                        <td className="p-4 align-top font-bold text-foreground">
                          sb-…-auth-token
                        </td>
                        <td className="p-4 align-top">
                          Přihlášení, obnovení a zabezpečení uživatelské relace
                          prostřednictvím Supabase Auth.
                        </td>
                        <td className="p-4 align-top">
                          Nezbytné; po dobu relace nebo platnosti přihlášení.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 align-top font-bold text-foreground">
                          navi:tracking-consent-v2
                        </td>
                        <td className="p-4 align-top">
                          Záznam volby Analytika / Marketing v localStorage
                          prohlížeče.
                        </td>
                        <td className="p-4 align-top">
                          Nezbytné; do změny volby nebo vymazání úložiště
                          prohlížeče.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 align-top font-bold text-foreground">
                          _ga, _ga_*
                        </td>
                        <td className="p-4 align-top">
                          Rozlišení prohlížeče a měření návštěvnosti pomocí
                          Google Analytics 4.
                        </td>
                        <td className="p-4 align-top">
                          Analytické; standardně až 2 roky, pouze po souhlasu.
                        </td>
                      </tr>
                      <tr>
                        <td className="p-4 align-top font-bold text-foreground">
                          _fbp, _fbc
                        </td>
                        <td className="p-4 align-top">
                          Rozlišení prohlížeče, měření návštěv a výkonu reklam
                          pomocí Meta Pixelu.
                        </td>
                        <td className="p-4 align-top">
                          Marketingové; až 90 dní, pouze po souhlasu.
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p>
                  Volbu můžete kdykoliv změnit přes „Nastavení cookies“ v
                  patičce. Odvoláním souhlasu zastavíte budoucí měření a web se
                  pokusí odstranit příslušné cookies z této domény. Můžete je
                  smazat také v nastavení prohlížeče; tím se může smazat i
                  uložená volba a lišta se zobrazí znovu.
                </p>
              </PolicySection>

              <PolicySection
                id="externi"
                number={9}
                title="Externí služby na webu"
              >
                <div className="grid gap-5">
                  <div>
                    <h3 className="font-extrabold text-foreground">
                      Google Analytics 4
                    </h3>
                    <p className="mt-2">
                      Google tag s ID měření G-6L9N41NKT8 načteme pouze po
                      povolení Analytiky. Může zpracovat pseudonymní ID
                      prohlížeče, navštívené stránky, přibližnou polohu
                      odvozenou z IP adresy a technické údaje o zařízení.
                      Reklamní úložiště, Google signals, personalizace reklam a
                      předávání údajů pro reklamu zůstávají vypnuté.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-foreground">
                      Meta Pixel
                    </h3>
                    <p className="mt-2">
                      Pixel s ID 1816423579552231 načteme pouze po povolení
                      Marketingu. Může zaznamenat návštěvu stránky, zahájení
                      platebního procesu, vytvoření rezervace a její potvrzení.
                      Z rezervačního formuláře mu neposíláme jméno, e-mail ani
                      telefon a nepoužíváme pokročilé párování. Meta může
                      přijaté údaje spojit s účtem uživatele a zpracovávat je
                      podle vlastních pravidel.
                    </p>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-foreground">
                      Mapy Google
                    </h3>
                    <p className="mt-2">
                      Mapa polohy studia používá Google Maps Platform. Při
                      načtení mapy prohlížeč komunikuje přímo se společností
                      Google, která získá zejména IP adresu, údaje o zařízení a
                      požadavku; mapě neposíláme vaše rezervační ani kontaktní
                      údaje. Google a NAVI mohou být pro toto zpracování
                      samostatnými správci. Použití Google Maps se řídí také{" "}
                      <a
                        className={link}
                        href="https://www.google.com/help/terms_maps/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        dodatečnými podmínkami Google Maps
                      </a>{" "}
                      a{" "}
                      <a
                        className={link}
                        href="https://policies.google.com/privacy"
                        target="_blank"
                        rel="noreferrer"
                      >
                        zásadami soukromí Google
                      </a>
                      .
                    </p>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-foreground">
                      Vercel Web Analytics a diagnostika
                    </h3>
                    <p className="mt-2">
                      Pro základní souhrnnou statistiku webu používáme Vercel
                      Web Analytics. Nástroj nepoužívá cookies, nespojuje IP
                      adresu s analytickou událostí a denně mění jednosměrný
                      identifikátor relace. Při aktivované diagnostice Sentry
                      mohou být při chybě zpracovány technické údaje, průběh
                      chybové relace a informace nutné k odstranění závady;
                      citlivé klíče a kontaktní údaje z provozních logů
                      automaticky maskujeme.
                    </p>
                  </div>
                </div>
              </PolicySection>

              <PolicySection id="prava" number={10} title="Vaše práva">
                <p>Za podmínek stanovených GDPR máte právo:</p>
                <ul className="grid gap-3 pl-5 marker:text-accent-foreground">
                  <li>získat potvrzení a přístup ke svým osobním údajům,</li>
                  <li>
                    požadovat opravu nepřesných nebo doplnění neúplných údajů,
                  </li>
                  <li>
                    požadovat výmaz údajů nebo omezení jejich zpracování, pokud
                    jsou splněny zákonné podmínky,
                  </li>
                  <li>
                    získat údaje poskytnuté na základě souhlasu nebo smlouvy ve
                    strojově čitelném formátu a případně je nechat předat jinému
                    správci,
                  </li>
                  <li>
                    kdykoliv odvolat souhlas; odvolání nemá vliv na zákonnost
                    dřívějšího zpracování,
                  </li>
                  <li>
                    vznést námitku proti zpracování založenému na oprávněném
                    zájmu. Proti přímému marketingu můžete namítat kdykoliv a
                    údaje pak pro tento účel přestaneme používat.
                  </li>
                </ul>
                <p>
                  Žádost pošlete na{" "}
                  <a className={link} href={`mailto:${contactEmail}`}>
                    {contactEmail}
                  </a>
                  . Než jí vyhovíme, můžeme přiměřeně ověřit vaši totožnost.
                  Odpovíme bez zbytečného odkladu, nejpozději ve lhůtě podle
                  GDPR.
                </p>
                <p>
                  Domníváte-li se, že údaje zpracováváme v rozporu s právem,
                  můžete podat stížnost u{" "}
                  <a
                    className={link}
                    href="https://uoou.gov.cz/kontakt/podatelna-a-elektronicka-podatelna"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Úřadu pro ochranu osobních údajů
                  </a>
                  , Pplk. Sochora 27, 170 00 Praha 7, e-mail{" "}
                  <a className={link} href="mailto:posta@uoou.gov.cz">
                    posta@uoou.gov.cz
                  </a>
                  .
                </p>
              </PolicySection>

              <PolicySection id="dalsi" number={11} title="Další informace">
                <p>
                  Samostatnou rezervaci a uživatelský účet může vytvořit osoba
                  starší 18 let. Údaje nezletilých nezískáváme cíleně, mohou se
                  však objevit v bezpečnostním nebo kamerovém záznamu, pokud
                  nezletilý navštíví studio v souladu s provozním řádem, nebo v
                  písemném souhlasu zákonného zástupce.
                </p>
                <p>
                  NAVI neprovádí automatizované individuální rozhodování, které
                  by pro vás mělo právní nebo obdobně významné účinky. Volitelné
                  analytické a marketingové nástroje mohou vytvářet pseudonymní
                  statistiky nebo publika podle pravidel svých poskytovatelů.
                </p>
                <p>
                  Tyto zásady můžeme měnit, zejména při změně služeb nebo
                  právních předpisů. Aktuální znění vždy zveřejníme na této
                  stránce a u významné změny přiměřeně upozorníme registrované
                  klienty.
                </p>
              </PolicySection>
            </article>
          </Container>
        </Section>
      </main>
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
