import { LAUNCH_PLAN, computeProgress, type PlanStatus } from "@/lib/data/launch-plan";

export const metadata = { title: "Plán spuštění" };

const STATUS_LABEL: Record<PlanStatus, string> = {
  done: "Hotovo",
  in_progress: "Rozpracováno",
  todo: "Zbývá",
  blocked: "Čeká na tebe",
};

const ICON: Record<PlanStatus, string> = {
  done: "✅",
  in_progress: "🟡",
  todo: "⬜",
  blocked: "⛔",
};

/**
 * Launch plan with a progress bar. Data + weighting live in
 * src/lib/data/launch-plan.ts — flip an item's `status` to update the bar.
 */
export default function PlanPage() {
  const p = computeProgress();

  return (
    <div>
      <h1>Plán spuštění</h1>
      <p style={{ color: "var(--muted)" }}>
        Přehled toho, co je hotové a co ještě zbývá do spuštění. Položky „Čeká na
        tebe“ vyžadují nastavení účtů/klíčů — detaily v souboru NEEDED.md.
      </p>

      {/* Progress bar */}
      <div style={{ margin: "1.25rem 0 0.5rem", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <strong style={{ fontSize: "1.5rem" }}>{p.percent} %</strong>
        <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>
          {p.done}/{p.total} hotovo · {p.inProgress} rozpracováno · {p.blocked} čeká na tebe · {p.todo} zbývá
        </span>
      </div>
      <div style={{ height: 16, borderRadius: 999, background: "var(--color-muted)", overflow: "hidden" }}>
        <div
          style={{
            width: `${p.percent}%`,
            height: "100%",
            background: "var(--color-primary)",
            transition: "width .3s ease",
          }}
        />
      </div>

      {/* Phases */}
      <div style={{ marginTop: "2rem", display: "grid", gap: "1.25rem" }}>
        {LAUNCH_PLAN.map((phase) => {
          const phaseProgress = computeProgress([phase]);
          return (
            <section
              key={phase.title}
              style={{ border: "1px solid var(--border)", borderRadius: 10, padding: "1rem" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{phase.title}</h2>
                <span style={{ color: "var(--muted)", fontSize: "0.85rem" }}>{phaseProgress.percent} %</span>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0.75rem 0 0" }}>
                {phase.items.map((item) => (
                  <li
                    key={item.title}
                    style={{ display: "flex", gap: "0.5rem", padding: "0.35rem 0", alignItems: "baseline" }}
                  >
                    <span aria-hidden>{ICON[item.status]}</span>
                    <span style={{ flex: 1 }}>
                      {item.title}
                      {item.note && (
                        <span style={{ color: "var(--muted)", fontSize: "0.82rem" }}> — {item.note}</span>
                      )}
                    </span>
                    <span style={{ color: "var(--muted)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
                      {STATUS_LABEL[item.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
