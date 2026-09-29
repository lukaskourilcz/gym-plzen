import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import {
  ACCESS_CODE_NOTICE_MINUTES,
  ACCESS_CODE_PREPARE_MINUTES,
} from "@/lib/config/access-code-delivery";
import {
  PAYMENT_SESSION_MINUTES,
  UNSTARTED_HOLD_MINUTES,
} from "@/lib/config/checkout";
import { FREE_ENTRY_EVERY } from "@/lib/config/pricing";
import { DEFAULT_SHOWER_MINUTES } from "@/lib/config/schedule";
import {
  MAX_CUSTOMER_RESCHEDULES,
  RESCHEDULE_CUTOFF_HOURS,
} from "@/lib/services/rescheduling";

export const metadata = { title: "Jak co funguje?" };

const TOPICS = [
  ["prehled", "Rezervace v pěti krocích"],
  ["vyber", "Výběr termínu a souběh"],
  ["platba", "Platba a potvrzení"],
  ["kod", "Kód, e-mail a WhatsApp"],
  ["zmena", "Změna a zrušení"],
  ["ucet", "Účet, ceny a vouchery"],
  ["administrace", "Co najdu v administraci"],
  ["potize", "Když něco nefunguje"],
] as const;

function Question({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="rounded-lg border border-border bg-card px-4 py-3 open:pb-4">
      <summary className="cursor-pointer font-semibold">{title}</summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-8 space-y-4"
    >
      <h2 id={`${id}-title`} className="text-2xl font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function HowItWorksPage() {
  await requireAdmin();
  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Jak co funguje?"
        description="Jednoduchý průvodce pro majitele posilovny"
      />
      <p className="mb-6 max-w-3xl text-muted-foreground">
        Zde je popsané, co zákazník vidí, co dělá web automaticky a kdy je
        potřeba zásah obsluhy. Rezervační systém pracuje s konkrétními termíny
        podle nastavené otevírací doby a délky rezervace.
      </p>

      <nav
        aria-label="Obsah průvodce"
        className="mb-10 rounded-xl border border-border bg-card p-5"
      >
        <h2 className="mb-3 font-bold">Přejít na téma</h2>
        <ol className="grid gap-2 text-sm sm:grid-cols-2">
          {TOPICS.map(([id, label]) => (
            <li key={id}>
              <a
                className="text-accent-foreground hover:underline"
                href={`#${id}`}
              >
                {label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="space-y-12">
        <Section id="prehled" title="Rezervace v pěti krocích">
          <ol className="grid gap-3 md:grid-cols-5">
            {[
              ["1", "Výběr", "Zákazník zvolí jeden nebo více volných termínů."],
              [
                "2",
                "Údaje",
                "Vyplní kontakt, potvrdí pravidla a případně zadá voucher.",
              ],
              [
                "3",
                "Platba",
                "Termíny jsou dočasně obsazené; po zaplacení se potvrdí.",
              ],
              ["4", "Příprava", "Systém připraví kód v Nuki a zkontroluje ho."],
              [
                "5",
                "Vstup",
                "Hodinu předem pošle kód, který platí v čase návštěvy.",
              ],
            ].map(([number, title, description]) => (
              <li
                key={number}
                className="rounded-lg border border-border bg-card p-4"
              >
                <span className="mb-2 inline-flex size-7 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {number}
                </span>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              </li>
            ))}
          </ol>
        </Section>

        <Section id="vyber" title="Výběr termínu a souběh">
          <Question title="Co rozhoduje o tom, zda je termín volný?">
            <p>
              Kalendář vychází z otevírací doby, administrátorských bloků, už
              rozpracovaných plateb a potvrzených rezervací. Veřejnosti nabídne
              jen budoucí termíny v povoleném období.{" "}
              <Link
                href="/admin/schedule"
                className="text-accent-foreground hover:underline"
              >
                Otevírací doba a bloky →
              </Link>
            </p>
          </Question>
          <Question title="Co když dva lidé kliknou na stejný čas?">
            <p>
              Volný termín vidí oba, dokud jeden nezačne rezervaci. Při uložení
              se obsazení kontroluje znovu a databáze nedovolí dvě překrývající
              se aktivní rezervace. Druhý zákazník dostane zprávu, že si má
              vybrat jiný čas. Nikdo za obsazený termín nemá platit.
            </p>
          </Question>
          <Question title="Jak funguje rezervace více termínů najednou?">
            <p>
              Všechny zvolené termíny se vezmou jako jedna objednávka s jednou
              platbou. Buď se dočasně obsadí všechny, nebo žádný. Když se
              mezitím jeden termín obsadí, zákazník musí výběr upravit. Voucher
              se uplatňuje na objednávku jednou; každý termín pak má vlastní
              vstupní kód.
            </p>
          </Question>
          <Question title="Jak dlouho jsou termíny během platby blokované?">
            <p>
              Platební stránka Comgate je připravená na{" "}
              {PAYMENT_SESSION_MINUTES} minut. Po celou dobu se termíny nenabízí
              dalším lidem. Pokud se platební stránku nepodaří ani otevřít,
              systém takové nezahájené držení uvolní po přibližně{" "}
              {UNSTARTED_HOLD_MINUTES} minutách. Když je výsledek platby
              nejasný, systém nejdřív ověří Comgate; termín neuvolní jen podle
              hodin, aby nemohli zaplatit dva lidé za stejný čas.
            </p>
          </Question>
        </Section>

        <Section id="platba" title="Platba a potvrzení">
          <Question title="Co se stane po zaplacení?">
            <p>
              Web si ověří platbu u Comgate. Po úspěchu potvrdí objednávku a
              všechny její termíny, pošle zákazníkovi potvrzovací e-mail a podle
              nastavení upozorní obsluhu. Doklad vytvoří a odešle jen tehdy,
              když je vyplněný fakturační profil a automatické doklady jsou
              zapnuté.{" "}
              <Link
                href="/admin/doklady"
                className="text-accent-foreground hover:underline"
              >
                Doklady →
              </Link>
            </p>
          </Question>
          <Question title="Co když zákazník odejde z platební stránky nebo se vrátí zpět?">
            <p>
              Dokud je platba rozpracovaná, termíny zůstávají držené. Při
              pokračování web naváže na stejnou platbu a nezakládá další.
              Neúspěšnou nebo vypršelou platbu ověří automatická kontrola a
              termíny poté uvolní. Pokud poskytovatel nedá jasnou odpověď,
              objeví se upozornění pro obsluhu.
            </p>
          </Question>
          <Question title="Kdy se potvrzuje rezervace zdarma?">
            <p>
              Plně zaplacená voucherem nebo věrnostním vstupem se potvrdí hned,
              bez přechodu na platební bránu. Potvrzení a následná příprava kódu
              fungují stejně jako u zaplacené rezervace.
            </p>
          </Question>
        </Section>

        <Section id="kod" title="Kód, e-mail a WhatsApp">
          <Card>
            <CardContent className="p-5">
              <h3 className="font-bold">
                Časová osa jedné potvrzené rezervace
              </h3>
              <ol className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
                <li>
                  <strong>
                    {ACCESS_CODE_PREPARE_MINUTES / 60} hodin předem:
                  </strong>{" "}
                  vytvoří se PIN a ověří se, že je v Nuki se správnou platností.
                </li>
                <li>
                  <strong>{ACCESS_CODE_NOTICE_MINUTES} minut předem:</strong>{" "}
                  odejde e-mail s PINem a případně také WhatsApp.
                </li>
                <li>
                  <strong>Během návštěvy:</strong> PIN funguje od začátku
                  rezervace do jejího konce a ještě po dobu na sprchu (výchozí
                  nastavení {DEFAULT_SHOWER_MINUTES} minut).
                </li>
              </ol>
            </CardContent>
          </Card>
          <Question title="Vzniká kód i u rezervace na poslední chvíli?">
            <p>
              Ano. Pokud je potvrzená rezervace už blíž než 24 hodin, systém
              zahájí přípravu hned. PIN se ale neposílá předčasně: běžně až
              hodinu před začátkem. U rezervace vytvořené v poslední hodině
              začne odeslání po potvrzení, jakmile je kód ověřený.
            </p>
          </Question>
          <Question title="Komu přijde WhatsApp?">
            <p>
              Jen přihlášenému zákazníkovi, který má ve svém profilu telefon a
              zapnutou volbu „Také přes WhatsApp“. Host bez účtu dostává PIN
              e-mailem. E-mail je povinná cesta a na WhatsAppu nezávisí.{" "}
              <Link
                href="/admin/messages"
                className="text-accent-foreground hover:underline"
              >
                Odeslané zprávy →
              </Link>
            </p>
          </Question>
          <Question title="Co znamená „odesláno“, „doručeno“ a „přečteno“?">
            <p>
              „Odesláno“ znamená, že zprávu přijal poskytovatel. „Doručeno“ nebo
              „přečteno“ se ukáže až po jeho potvrzení. Stav proto může chvíli
              zůstat na „odesláno“, i když zpráva už dorazila.
            </p>
          </Question>
          <Question title="Co když Nuki nebo odeslání selže?">
            <p>
              Web neposílá neověřený kód. Automatická kontrola chybu opakuje a v{" "}
              <Link
                href="/admin/alerts"
                className="text-accent-foreground hover:underline"
              >
                Upozorněních
              </Link>{" "}
              ukáže, co vyžaduje zásah. Stav každé zítřejší rezervace uvidíte na
              stránce{" "}
              <Link
                href="/admin/tomorrow"
                className="text-accent-foreground hover:underline"
              >
                Zítra
              </Link>
              . Chyba WhatsAppu neblokuje odeslání e-mailu.
            </p>
          </Question>
        </Section>

        <Section id="zmena" title="Změna a zrušení rezervace">
          <Question title="Může zákazník přesunout termín?">
            <p>
              Přihlášený zákazník může potvrzenou rezervaci změnit nejvýše{" "}
              {MAX_CUSTOMER_RESCHEDULES}×, a to nejpozději{" "}
              {RESCHEDULE_CUTOFF_HOURS} hodin před začátkem. Vybere jiný volný
              termín. Starý kód se odebere, nový se připraví pro nový čas a
              zákazník dostane potvrzení změny.
            </p>
          </Question>
          <Question title="Co se stane při zrušení zákazníkem?">
            <p>
              Potvrzenou rezervaci může zrušit před začátkem. Web žádá druhé
              potvrzení a jasně říká, že zaplacená cena se nevrací. Kód se
              odebere. Pokud zámek odebrání nepotvrdí, původní čas zůstane z
              bezpečnostních důvodů blokovaný a obsluha dostane upozornění.
            </p>
          </Question>
          <Question title="Co když rezervaci zruší obsluha?">
            <p>
              Administrace vyžaduje potvrzení storna. U zaplacené rezervace
              vytvoří upozornění, že je potřeba ověřit nárok a případně vrátit
              platbu v Comgate. Samotné storno peníze automaticky nevrací.{" "}
              <Link
                href="/admin/finance"
                className="text-accent-foreground hover:underline"
              >
                Finance →
              </Link>
            </p>
          </Question>
        </Section>

        <Section id="ucet" title="Účet, ceny a vouchery">
          <Question title="Co zákazník najde v profilu?">
            <p>
              Své budoucí rezervace a objednávky, historii, věrnostní postup,
              telefon a nastavení WhatsAppu. U způsobilé rezervace má tlačítka
              pro změnu nebo zrušení. Host bez účtu potvrzení dostane e-mailem,
              ale profil ani WhatsApp volbu nemá.
            </p>
          </Question>
          <Question title="Jak funguje cena a věrnost?">
            <p>
              Cenu za termín určuje nastavené vstupné, případně cenové období. U
              přihlášeného zákazníka je každá {FREE_ENTRY_EVERY}. započítaná
              potvrzená rezervace zdarma; zrušené rezervace se nepočítají. Nejde
              o měsíční předplatné.{" "}
              <Link
                href="/admin/memberships"
                className="text-accent-foreground hover:underline"
              >
                Vstupné a věrnost →
              </Link>
            </p>
          </Question>
          <Question title="Jak funguje voucher?">
            <p>
              Kód může dát pevnou nebo procentní slevu. Při rezervaci se jeho
              použití dočasně podrží a po potvrzení se započítá. Pokud se nákup
              nedokončí, vrátí se k použití. Stoprocentní sleva potvrdí
              rezervaci bez platby.{" "}
              <Link
                href="/admin/vouchers"
                className="text-accent-foreground hover:underline"
              >
                Vouchery →
              </Link>
            </p>
          </Question>
        </Section>

        <Section id="administrace" title="Co najdu v administraci">
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["/admin", "Dnes", "Dnešní rezervace, vstupy a upozornění."],
              [
                "/admin/tomorrow",
                "Zítra",
                "Kontrola kódů, Nuki a odeslaných zpráv pro další den.",
              ],
              [
                "/admin/calendar",
                "Kalendář",
                "Přehled obsazených a volných termínů.",
              ],
              [
                "/admin/reservations",
                "Rezervace",
                "Ruční rezervace a dvoukrokové storno.",
              ],
              [
                "/admin/schedule",
                "Otevírací doba a bloky",
                "Kdy se dá rezervovat a kdy je posilovna zavřená.",
              ],
              [
                "/admin/access-codes",
                "Vstupní kódy",
                "Podrobný stav kódů v Nuki.",
              ],
              [
                "/admin/entry-log",
                "Kniha vstupů",
                "Zaznamenaná odemčení; neodchody zákazníků.",
              ],
              [
                "/admin/members",
                "Členové",
                "Účty, kontakty a historie zákazníků.",
              ],
              [
                "/admin/memberships",
                "Vstupné a věrnost",
                "Ceník, cenová období a věrnostní pravidla.",
              ],
              ["/admin/vouchers", "Vouchery", "Slevové kódy a jejich použití."],
              [
                "/admin/doklady",
                "Doklady",
                "Fakturační údaje, vystavení a odeslání dokladů.",
              ],
              [
                "/admin/messages",
                "Odeslané zprávy",
                "Stav zákaznických e-mailů a WhatsAppu.",
              ],
              [
                "/admin/finance",
                "Finance",
                "Přijaté platby, slevy a vratky k ověření.",
              ],
              [
                "/admin/statistics",
                "Statistiky",
                "Počty rezervací a vytížení.",
              ],
              [
                "/admin/alerts",
                "Upozornění",
                "Chyby, které vyžadují kontrolu obsluhy.",
              ],
              [
                "/admin/activity",
                "Historie akcí",
                "Kdo a kdy provedl důležitou změnu.",
              ],
              [
                "/admin/content",
                "Obsah webu",
                "Veřejné texty a údaje na webu.",
              ],
              ["/admin/emails", "E-maily", "Podoby automatických e-mailů."],
              [
                "/admin/newsletter",
                "Odběratelé novinek",
                "Kontakty se souhlasem k novinkám.",
              ],
              [
                "/admin/settings",
                "Nastavení a branding",
                "Provozní a vzhledová nastavení webu.",
              ],
              [
                "/admin/design-system",
                "Design systém",
                "Ukázka vzhledu a ovládacích prvků webu.",
              ],
            ].map(([href, title, description]) => (
              <Card key={href}>
                <CardContent className="p-4">
                  <h3 className="font-bold">
                    <Link
                      href={href!}
                      className="text-accent-foreground hover:underline"
                    >
                      {title} →
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <Section id="potize" title="Když něco nefunguje">
          <Question title="Večer chybí kód na zítřek. Co mám zkontrolovat?">
            <p>
              Na stránce{" "}
              <Link
                href="/admin/tomorrow"
                className="text-accent-foreground hover:underline"
              >
                Zítra
              </Link>{" "}
              nejprve ověřte, zda už nastalo 24 hodin před začátkem. Pokud ano a
              kód stále chybí, podívejte se do{" "}
              <Link
                href="/admin/alerts"
                className="text-accent-foreground hover:underline"
              >
                Upozornění
              </Link>{" "}
              a{" "}
              <Link
                href="/admin/access-codes"
                className="text-accent-foreground hover:underline"
              >
                Vstupních kódů
              </Link>
              . Dokud není shoda s Nuki potvrzená, nespoléhejte na samotný stav
              „připravuje se“.
            </p>
          </Question>
          <Question title="Hodinu před rezervací není zpráva. Co mám dělat?">
            <p>
              Zkontrolujte stav e-mailu a WhatsAppu na stránce Zítra a pak
              podrobnosti v Odeslaných zprávách. WhatsApp se týká jen
              přihlášených zákazníků, kteří si ho zapnuli. Pokud e-mail nebo kód
              selhal, otevřete Upozornění; systém pokusy automaticky opakuje,
              ale obsluha má problém sledovat.
            </p>
          </Question>
          <Question title="Ukazuje Finance vratku. Znamená to, že už odešla?">
            <p>
              Ne. Upozornění na vratku je úkol ke kontrole, ne potvrzení platby.
              Stav vrácení ověřte v Comgate. Označení upozornění jako „Vyřešeno“
              samo žádné peníze nepřevádí.
            </p>
          </Question>
        </Section>
      </div>
    </div>
  );
}
