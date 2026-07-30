import type { Metadata } from "next";
import Link from "next/link";
import {
  footerProps,
  loadSiteContent,
  PUBLIC_ADDRESS,
} from "@/lib/content/site";
import { formatMoney, minutesToHHmm } from "@/lib/helpers/format";
import {
  DEFAULT_CLOSE_MINUTE,
  DEFAULT_OPEN_MINUTE,
  DEFAULT_SLOT_MINUTES,
} from "@/lib/config/schedule";
import { Container, Section } from "@/components/ui/container";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { LotusMark } from "@/components/site/brand";

export const metadata: Metadata = {
  title: "Často kladené otázky",
  description:
    "Odpovědi k rezervaci, platbě, vstupu a poloze NAMASTÉ Private Gym.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const content = await loadSiteContent();
  const price = formatMoney(content.entryPriceCents);
  const groupPrice = formatMoney(Math.round(content.entryPriceCents / 5));
  const items = [
    {
      question: "Jak se k nám dostanete?",
      answerText: `Najdete nás na adrese ${PUBLIC_ADDRESS}. Můžete k nám pohodlně přijet autem. Autobusová zastávka Rondel je vzdálená přibližně 300 metrů.`,
      answer: (
        <>
          Najdete nás na adrese {PUBLIC_ADDRESS}. Můžete k nám pohodlně přijet
          autem. Autobusová zastávka Rondel je vzdálená přibližně 300 metrů.
        </>
      ),
    },
    {
      question: "Dá se u vás zaparkovat?",
      answerText:
        "Ano, přímo před studiem je k dispozici dostatek parkovacích míst.",
      answer:
        "Ano, přímo před studiem je k dispozici dostatek parkovacích míst.",
    },
    {
      question: "Jsem začátečník, mohu si vaše studio pronajmout?",
      answerText:
        "Samozřejmě. Studio je navrženo pro každého, od úplných začátečníků po zkušené sportovce. Pokud si nebudete vědět rady s ovládáním strojů, můžete přijít s vlastním trenérem nebo později využít připravovaného videorádce.",
      answer:
        "Samozřejmě. Studio je navrženo pro každého, od úplných začátečníků po zkušené sportovce. Pokud si nebudete vědět rady s ovládáním strojů, můžete přijít s vlastním trenérem nebo později využít připravovaného videorádce.",
    },
    {
      question: "Je vstup do studia omezen věkem?",
      answerText:
        "Ano, rezervaci může vytvořit pouze osoba starší 18 let. V jejím doprovodu však mohou přijít také děti nebo mladiství.",
      answer:
        "Ano, rezervaci může vytvořit pouze osoba starší 18 let. V jejím doprovodu však mohou přijít také děti nebo mladiství.",
    },
    {
      question: "Mohu přijít i s dětmi?",
      answerText:
        "Ano. Pro děti je připraven vybavený vnitřní dětský koutek a venkovní pískoviště. Za přítomnost dětí a jejich bezpečnost nese plnou odpovědnost jejich doprovod. Dětem je z bezpečnostních důvodů přísně zakázáno používat cvičební stroje.",
      answer:
        "Ano. Pro děti je připraven vybavený vnitřní dětský koutek a venkovní pískoviště. Za přítomnost dětí a jejich bezpečnost nese plnou odpovědnost jejich doprovod. Dětem je z bezpečnostních důvodů přísně zakázáno používat cvičební stroje.",
    },
    {
      question:
        "Kolik lidí může přijít na jednu rezervaci? Budou tam další osoby?",
      answerText:
        "Nebudou. Celý prostor je ve vašem časovém okně rezervován exkluzivně pro vás a váš doprovod. Nikdo cizí se v prostoru pohybovat nebude. Maximální kapacita je 5 osob včetně dětí.",
      answer:
        "Nebudou. Celý prostor je ve vašem časovém okně rezervován exkluzivně pro vás a váš doprovod. Nikdo cizí se v prostoru pohybovat nebude. Maximální kapacita je 5 osob včetně dětí.",
    },
    {
      question: "Budu platit více, když do studia nepůjdu sám nebo sama?",
      answerText: `Ne. Cena je jednotná a bez příplatků. Za ${DEFAULT_SLOT_MINUTES} minut zaplatíte ${price}, a to až pro 5 osob. Při návštěvě v pěti vychází rezervace jednoho člověka na ${groupPrice}.`,
      answer: (
        <>
          Ne. Cena je jednotná a bez příplatků. Za {DEFAULT_SLOT_MINUTES} minut
          zaplatíte {price}, a to až pro 5 osob. Při návštěvě v pěti vychází
          rezervace jednoho člověka na {groupPrice}.
        </>
      ),
    },
    {
      question: "Jak se dostanu dovnitř? Bude na místě recepce?",
      answerText:
        "Fungujeme jako plně samoobslužné studio, takže u nás klasickou recepci nenajdete. Před rezervovaným časem obdržíte číselný kód. Zadáte ho u vstupu a dveře se automaticky odemknou.",
      answer:
        "Fungujeme jako plně samoobslužné studio, takže u nás klasickou recepci nenajdete. Před rezervovaným časem obdržíte číselný kód. Zadáte ho u vstupu a dveře se automaticky odemknou.",
    },
    {
      question: "Co když přijdu později?",
      answerText:
        "Nevadí. Vstupní kód je platný po celou dobu rezervovaného časového okna. Pozdním příchodem se však připravujete o část zaplaceného času.",
      answer:
        "Nevadí. Vstupní kód je platný po celou dobu rezervovaného časového okna. Pozdním příchodem se však připravujete o část zaplaceného času.",
    },
    {
      question: "Nemohu se do studia dostat. Co mám dělat?",
      answerText:
        "Ihned zavolejte na telefonní číslo uvedené v kontaktech. Problém vyřešíme na dálku.",
      answer: (
        <>
          Ihned zavolejte na telefonní číslo uvedené v{" "}
          <Link
            href="/#kontakt"
            className="font-bold text-foreground underline underline-offset-4"
          >
            kontaktech
          </Link>
          . Problém vyřešíme na dálku.
        </>
      ),
    },
    {
      question: "Jaké jsou způsoby platby?",
      answerText:
        "Platba probíhá bezpečně online přes integrovanou platební bránu Stripe. Zaplatit můžete platební kartou, přes Google Pay nebo Apple Pay.",
      answer:
        "Platba probíhá bezpečně online přes integrovanou platební bránu Stripe. Zaplatit můžete platební kartou, přes Google Pay nebo Apple Pay.",
    },
    {
      question: "Je možné rezervaci stornovat?",
      answerText:
        "Ano. Bezplatné storno nebo změnu termínu lze provést nejpozději 24 hodin před začátkem rezervace.",
      answer:
        "Ano. Bezplatné storno nebo změnu termínu lze provést nejpozději 24 hodin před začátkem rezervace.",
    },
    {
      question: "Jaká je otevírací doba Namasté Private Gym?",
      answerText: `Otevřeno máme každý den od ${minutesToHHmm(DEFAULT_OPEN_MINUTE)} do ${minutesToHHmm(DEFAULT_CLOSE_MINUTE)}.`,
      answer: `Otevřeno máme každý den od ${minutesToHHmm(DEFAULT_OPEN_MINUTE)} do ${minutesToHHmm(DEFAULT_CLOSE_MINUTE)}.`,
    },
    {
      question: "Jak je ve studiu řešena bezpečnost?",
      answerText:
        "Prostor je vybaven řádně označenými únikovými východy, hasicími přístroji a lékárničkou. Z bezpečnostních a ochranných důvodů je celý prostor monitorován kamerovým systémem.",
      answer:
        "Prostor je vybaven řádně označenými únikovými východy, hasicími přístroji a lékárničkou. Z bezpečnostních a ochranných důvodů je celý prostor monitorován kamerovým systémem.",
    },
    {
      question: "Jaké vybavení u vás najdu?",
      answerText:
        "Přesný seznam cvičebních strojů a pomůcek najdete na stránce Vybavení. Vedle fitness zóny je k dispozici dětský koutek, malá zahrádka s pískovištěm, relaxační zóna, koupelna se sprchou a WC a lednice s nápoji a drobným občerstvením.",
      answer: (
        <>
          Přesný seznam cvičebních strojů a pomůcek najdete na stránce{" "}
          <Link
            href="/vybaveni"
            className="font-bold text-foreground underline underline-offset-4"
          >
            Vybavení
          </Link>
          . Vedle fitness zóny je k dispozici dětský koutek, malá zahrádka s
          pískovištěm, relaxační zóna, koupelna se sprchou a WC a lednice s
          nápoji a drobným občerstvením.
        </>
      ),
    },
    {
      question: "Je občerstvení v lednici zdarma?",
      answerText:
        "Není. Za produkty z lednice zaplatíte pomocí QR kódu přes bankovní aplikaci. Ceník i QR kód najdete na viditelném místě přímo na lednici.",
      answer:
        "Není. Za produkty z lednice zaplatíte pomocí QR kódu přes bankovní aplikaci. Ceník i QR kód najdete na viditelném místě přímo na lednici.",
    },
    {
      question: "Nabízíte služby osobního trenéra?",
      answerText:
        "Vlastní trenéry stabilně nezaměstnáváme, ale spolupracujeme s několika plzeňskými trenéry, kteří studio pravidelně využívají. Pokud máte zájem, rádi vás s nimi propojíme.",
      answer:
        "Vlastní trenéry stabilně nezaměstnáváme, ale spolupracujeme s několika plzeňskými trenéry, kteří studio pravidelně využívají. Pokud máte zájem, rádi vás s nimi propojíme.",
    },
    {
      question: "Jak často se prostor uklízí a co dělat, když najdu nepořádek?",
      answerText:
        "Prostor je pravidelně profesionálně uklízen. Pokud při příchodu zjistíte znečištění nebo poškození vybavení, ihned nás kontaktujte. Děkujeme, že nám pomáháte udržovat Namasté čisté.",
      answer:
        "Prostor je pravidelně profesionálně uklízen. Pokud při příchodu zjistíte znečištění nebo poškození vybavení, ihned nás kontaktujte. Děkujeme, že nám pomáháte udržovat Namasté čisté.",
    },
    {
      question: "Mohu si ve studiu natáčet videa nebo fotografovat?",
      answerText:
        "Ano. Budeme rádi, když své momenty z tréninku zaznamenáte a označíte nás na Instagramu jako @namaste_plzen.",
      answer: (
        <>
          Ano. Budeme rádi, když své momenty z tréninku zaznamenáte a označíte
          nás na Instagramu jako <strong>@namaste_plzen</strong>.
        </>
      ),
    },
    {
      question: "Je možné si ke cvičení pustit vlastní hudbu?",
      answerText:
        "Ano. Ve studiu je reproduktor, ke kterému se připojíte přes Bluetooth. Protože jsou nad studiem byty, pouštějte hudbu ohleduplně. Od 22:00 do 6:00 je používání reproduktoru kvůli nočnímu klidu zakázáno.",
      answer:
        "Ano. Ve studiu je reproduktor, ke kterému se připojíte přes Bluetooth. Protože jsou nad studiem byty, pouštějte hudbu ohleduplně. Od 22:00 do 6:00 je používání reproduktoru kvůli nočnímu klidu zakázáno.",
    },
  ];
  const faqJson = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map(({ question, answerText }) => ({
      "@type": "Question",
      name: question,
      acceptedAnswer: { "@type": "Answer", text: answerText },
    })),
  };

  return (
    <>
      <SiteHeader brand={content.get("brand.name")} />
      <main id="main-content" tabIndex={-1}>
        <Section className="pt-14 sm:pt-20">
          <Container className="max-w-4xl">
            <h1 className="text-4xl font-extrabold tracking-[-.01em] sm:text-6xl">
              Často kladené otázky
            </h1>
            <div className="mt-10 divide-y divide-border border-y border-border">
              {items.map(({ question, answer }) => (
                <details key={question} className="group py-1">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center gap-4 py-4 text-lg font-extrabold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <LotusMark
                      decorative
                      className="size-7 shrink-0 text-muted-foreground transition-[rotate,color] duration-[320ms] ease-brand-spring group-open:rotate-90 group-open:text-accent-foreground motion-safe:group-hover:text-accent-foreground"
                    />
                    {question}
                  </summary>
                  <p className="max-w-2xl pb-6 pl-11 leading-7 text-muted-foreground">
                    {answer}
                  </p>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-between gap-4 bg-secondary p-6">
              <p className="font-bold">Vyberte datum a volný čas.</p>
              <Button href="/rezervace">Otevřít kalendář</Button>
            </div>
          </Container>
        </Section>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJson).replace(/</g, "\\u003c"),
        }}
      />
      <SiteFooter {...footerProps(content)} />
    </>
  );
}
