import { INSPIRATIONS, INSPIRATION_TAKEAWAYS } from "@/lib/data/inspirations";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Inspirace" };

const lockCount = INSPIRATIONS.filter((g) => !g.designBenchmark).length;
const designCount = INSPIRATIONS.filter((g) => g.designBenchmark).length;

/** Browsable preview of real gyms that run our concept + design benchmarks. */
export default function InspirationsPage() {
  return (
    <div>
      <PageHeader title="Inspirace — gymy bez obsluhy se zámkem" />
      <p className="mb-6 max-w-3xl text-sm text-muted-foreground">
        Skutečné, ověřené provozy po celém světě (důraz na trh USA). {lockCount} z nich běží na{" "}
        <strong className="text-foreground">stejném konceptu jako my</strong> — bez recepce, vstup
        přes chytrý zámek / PIN, rezervace a platba online. Dalších {designCount} je zařazeno hlavně
        jako <strong className="text-foreground">designová inspirace</strong>. U každého je náhled
        funkcí a jak vypadají jejich formuláře a frontend.
      </p>

      <Card className="mb-6 bg-muted/40">
        <CardContent className="p-4">
          <h2 className="mb-2 font-semibold">Co si vzít — souhrn</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {INSPIRATION_TAKEAWAYS.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {INSPIRATIONS.map((g) => (
          <Card key={g.url} className={g.closest ? "border-l-4 border-l-primary" : undefined}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="flex flex-wrap items-baseline gap-2 text-lg font-semibold">
                  {g.name}
                  <span className="text-sm font-normal text-muted-foreground">{g.location}</span>
                  {g.closest && <Badge>nejblíž našemu konceptu</Badge>}
                  {g.designBenchmark && <Badge variant="muted">designová inspirace</Badge>}
                  {g.applied && <Badge variant="accent">✓ aplikováno u nás</Badge>}
                </h2>
                <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  otevřít web ↗
                </a>
              </div>

              {g.applied && (
                <p className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 text-sm">
                  {g.applied}
                </p>
              )}

              <dl className="mt-3 grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm">
                <Term label="Přístup" value={g.access} />
                <Term label="Rezervace" value={g.booking} />
                <Term label="Platba" value={g.payment} />
                <Term label="Frontend & formuláře" value={g.frontend} />
              </dl>

              <div className="mt-3 flex flex-wrap gap-8">
                <BulletList title="Funkce" items={g.features} />
                <BulletList title="Co si vzít" items={g.ideas} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Plný rozbor se zdroji: <code>docs/INSPIRATIONS.md</code>.
      </p>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-medium">{label}</dt>
      <dd className="text-muted-foreground">{value}</dd>
    </>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="min-w-56 flex-1">
      <strong className="text-sm">{title}</strong>
      <ul className="mt-1 list-disc pl-5 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </div>
  );
}
