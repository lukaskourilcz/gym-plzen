/** Only exact superseded public copy; never rewrite custom CMS or legal text. */
const REVISIONS: Readonly<Record<string, string>> = {
  "Akční cena platí pro návštěvy v akčním období.":
    "Akční cena pro návštěvy do {promoEndsAt}.",
  "Rezervujte si celé samoobslužné fitness v Plzni jen pro sebe a svůj doprovod.":
    "Rezervuj si celé samoobslužné fitness v Plzni jen pro sebe a svůj doprovod.",
  "Stroje a pomůcky pro silový trénink máte po celou dobu rezervace jen pro sebe.":
    "Stroje a pomůcky pro silový trénink máš po celou dobu rezervace jen pro sebe.",
  "Zázemí pro vás": "Zázemí pro tebe",
  "Vyberte datum a volný čas.": "Vyber datum a volný čas.",
  "Jak se k nám dostanete?": "Jak se k nám dostaneš?",
  "Najdete nás na adrese Křížkova 424/23, 301 00 Plzeň - Roudná. Můžete k nám pohodlně přijet autem. Autobusová zastávka Rondel je vzdálená přibližně 300 metrů.":
    "Najdeš nás na adrese Křížkova 424/23, 301 00 Plzeň - Roudná. Můžeš k nám pohodlně přijet autem. Autobusová zastávka Rondel je vzdálená přibližně 300 metrů.",
  "Samozřejmě! Naše studio je navrženo pro každého – od naprostých začátečníků po zkušené sportovce. Pokud si nebudete vědět rady s ovládáním strojů, můžete si s sebou vzít vlastního trenéra nebo využít našeho videorádce (chystáme).":
    "Samozřejmě! Naše studio je navrženo pro každého – od naprostých začátečníků po zkušené sportovce. Pokud si nebudeš vědět rady s ovládáním strojů, můžeš si s sebou vzít vlastního trenéra nebo využít našeho videorádce (chystáme).",
  "Nebudou. Celý prostor je ve vašem časovém okně rezervován exkluzivně pro vás a váš doprovod. Nikdo cizí se v prostoru pohybovat nebude. Maximální kapacita je 5 osob včetně dětí.":
    "Nebudou. Celý prostor je ve tvém časovém okně rezervován exkluzivně pro tebe a tvůj doprovod. Nikdo cizí se v prostoru pohybovat nebude. Maximální kapacita je 5 osob včetně dětí.",
  "Fungujeme jako plně samoobslužné studio, takže u nás klasickou recepci nenajdete. Před rezervovaným časem obdržíte číselný kód. Zadáte ho u vstupu a dveře se automaticky odemknou.":
    "Fungujeme jako plně samoobslužné studio, takže u nás klasickou recepci nenajdeš. Před rezervovaným časem obdržíš číselný kód. Zadáš ho u vstupu a dveře se automaticky odemknou.",
  "Nevadí. Vstupní kód je platný po celou dobu rezervovaného časového okna. Pozdním příchodem se však připravujete o část zaplaceného času.":
    "Nevadí. Vstupní kód je platný po celou dobu rezervovaného časového okna. Pozdním příchodem se však připravuješ o část zaplaceného času.",
  "Ihned zavolejte na telefonní číslo uvedené v kontaktech. Problém vyřešíme na dálku.":
    "Ihned zavolej na telefonní číslo uvedené v kontaktech. Problém vyřešíme na dálku.",
  "Rezervace je platná až po zaplacení. Platí se online přes platební bránu Comgate; dostupné platební metody uvidíte při úhradě.":
    "Rezervace je platná až po zaplacení. Platí se online přes platební bránu Comgate; dostupné platební metody uvidíš při úhradě.",
  "Termín rezervace můžete jednou bezplatně změnit nejpozději 24 hodin před jeho začátkem. Rezervaci můžete také kdykoli před začátkem zrušit v sekci Můj účet; zaplacená cena se v takovém případě nevrací. Pokud jste rezervovali bez registrace, napište nám na e-mail v kontaktech.":
    "Termín rezervace můžeš jednou bezplatně změnit nejpozději 24 hodin před jeho začátkem. Rezervaci můžeš také kdykoli před začátkem zrušit v sekci Můj účet; zaplacená cena se v takovém případě nevrací. Pokud jsi rezervoval/a bez registrace, napiš nám na e-mail v kontaktech.",
  "Přesný seznam cvičebních strojů a pomůcek najdete na stránce Vybavení. Vedle fitness zóny je k dispozici dětský koutek, malá zahrádka s pískovištěm, relaxační zóna, koupelna se sprchou a WC a lednice s nápoji a drobným občerstvením.":
    "Přesný seznam cvičebních strojů a pomůcek najdeš na stránce Vybavení. Vedle fitness zóny je k dispozici dětský koutek, malá zahrádka s pískovištěm, relaxační zóna, koupelna se sprchou a WC a lednice s nápoji a drobným občerstvením.",
  "Není. Za produkty z lednice zaplatíte pomocí QR kódu přes bankovní aplikaci. Ceník i QR kód najdete na viditelném místě přímo na lednici.":
    "Není. Za produkty z lednice zaplatíš pomocí QR kódu přes bankovní aplikaci. Ceník i QR kód najdeš na viditelném místě přímo na lednici.",
  "Vlastní trenéry stabilně nezaměstnáváme, ale spolupracujeme s několika plzeňskými trenéry, kteří studio pravidelně využívají. Pokud máte zájem, rádi vás s nimi propojíme.":
    "Vlastní trenéry stabilně nezaměstnáváme, ale spolupracujeme s několika plzeňskými trenéry, kteří studio pravidelně využívají. Pokud máš zájem, rádi tě s nimi propojíme.",
  "Prostor je pravidelně profesionálně uklízen. Pokud při příchodu zjistíte znečištění nebo poškození vybavení, ihned nás kontaktujte. Děkujeme, že nám pomáháte udržovat prostor čistý.":
    "Prostor je pravidelně profesionálně uklízen. Pokud při příchodu zjistíš znečištění nebo poškození vybavení, ihned nás kontaktuj. Děkujeme, že nám pomáháš udržovat prostor čistý.",
  "Ano. Budeme rádi, když své momenty z tréninku zaznamenáte a označíte nás na Instagramu jako @navi_plzen.":
    "Ano. Budeme rádi, když své momenty z tréninku zaznamenáš a označíš nás na Instagramu jako @navi_plzen.",
  "Ano. Ve studiu je reproduktor, ke kterému se připojíte přes Bluetooth. Protože jsou nad studiem byty, pouštějte hudbu ohleduplně. Od 22:00 do 6:00 je používání reproduktoru kvůli nočnímu klidu zakázáno.":
    "Ano. Ve studiu je reproduktor, ke kterému se připojíš přes Bluetooth. Protože jsou nad studiem byty, pouštěj hudbu ohleduplně. Od 22:00 do 6:00 je používání reproduktoru kvůli nočnímu klidu zakázáno.",
  "Ano. V kalendáři vyberete až 10 termínů, i v různých dnech, a zaplatíte je jednou platbou. Cena je součtem cen jednotlivých termínů a slevový kód se uplatní na celou objednávku. Vstupní kód dostanete ke každému termínu zvlášť a změnu nebo storno řešíte u každého termínu samostatně.":
    "Ano. V kalendáři vybereš až 10 termínů, i v různých dnech, a zaplatíš je jednou platbou. Cena je součtem cen jednotlivých termínů a slevový kód se uplatní na celou objednávku. Vstupní kód dostaneš ke každému termínu zvlášť a změnu nebo storno řešíš u každého termínu samostatně.",
  "Nahlédněte do NAVI Private Gym.": "Nahlédni do NAVI Private Gym.",
  "Akční cena platí pro rezervace vytvořené během akce, i na termíny v dalších měsících.":
    "Akční cena pro návštěvy do {promoEndsAt}.",
};

export function revisePublicCopy(value: string): string {
  return REVISIONS[value] ?? value;
}
