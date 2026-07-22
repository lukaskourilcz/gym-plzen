import {
  LAUNCH_PLAN,
  computeProgress,
  type PlanStatus,
} from "@/lib/data/launch-plan";
import { PageHeader } from "@/components/admin/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Plán spuštění" };

const STATUS_LABEL: Record<PlanStatus, string> = {
  done: "Hotovo",
  in_progress: "Rozpracováno",
  todo: "Zbývá",
  blocked: "Čeká na tebe",
};

const ICON: Record<PlanStatus, string> = {
  done: "●",
  in_progress: "◐",
  todo: "○",
  blocked: "×",
};

/** Launch plan with a progress bar. Data + weighting in lib/data/launch-plan.ts. */
export default function PlanPage() {
  const p = computeProgress();

  return (
    <div>
      <PageHeader
        title="Plán spuštění"
        description="Stav příprav před spuštěním. Položky označené „Čeká na tebe“ vyžadují nastavení účtů nebo přístupových klíčů. Podrobnosti jsou v souboru NEEDED.md."
      />

      <div className="mb-1 flex items-baseline justify-between">
        <strong className="text-2xl">{p.percent} %</strong>
        <span className="text-sm text-muted-foreground">
          {p.done}/{p.total} hotovo · {p.inProgress} rozpracováno · {p.blocked}{" "}
          čeká na tebe · {p.todo} zbývá
        </span>
      </div>
      <div className="h-4 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${p.percent}%` }}
        />
      </div>

      <div className="mt-8 grid gap-5">
        {LAUNCH_PLAN.map((phase) => {
          const phaseProgress = computeProgress([phase]);
          return (
            <Card key={phase.title}>
              <CardContent className="p-4">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-base font-semibold">{phase.title}</h2>
                  <span className="text-sm text-muted-foreground">
                    {phaseProgress.percent} %
                  </span>
                </div>
                <ul className="mt-3 grid gap-1">
                  {phase.items.map((item) => (
                    <li
                      key={item.title}
                      className="flex items-baseline gap-2 py-0.5"
                    >
                      <span aria-hidden>{ICON[item.status]}</span>
                      <span className="flex-1">
                        {item.title}
                        {item.note && (
                          <span className="text-sm text-muted-foreground">
                            : {item.note}
                          </span>
                        )}
                      </span>
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {STATUS_LABEL[item.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
