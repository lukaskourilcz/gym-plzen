import { INSPIRATIONS, INSPIRATION_TAKEAWAYS } from "@/lib/data/inspirations";

export const metadata = { title: "Inspirace" };

const lockCount = INSPIRATIONS.filter((g) => !g.designBenchmark).length;
const designCount = INSPIRATIONS.filter((g) => g.designBenchmark).length;

/**
 * "Inspirace" — a browsable preview of real gyms worldwide that run our exact
 * concept (unmanned, smart-lock/PIN access, book & pay online). Data lives in
 * `src/lib/data/inspirations.ts`; the full sourced writeup is in
 * docs/INSPIRATIONS.md. Presentational only; visual polish comes later.
 */
export default function InspirationsPage() {
  return (
    <div>
      <h1>Inspirace — gymy bez obsluhy se zámkem</h1>
      <p style={{ color: "var(--muted)", maxWidth: 720 }}>
        Skutečné, ověřené provozy po celém světě (důraz na trh USA). {lockCount}{" "}
        z nich běží na <strong>stejném konceptu jako my</strong> — bez recepce,
        vstup přes chytrý zámek / PIN, rezervace a platba online. Dalších{" "}
        {designCount} je zařazeno hlavně jako <strong>designová inspirace</strong>{" "}
        (i když mají obsluhu). U každého je náhled funkcí a jak vypadají jejich
        formuláře a frontend.
      </p>

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "1rem",
          margin: "1.5rem 0",
          background: "#f8fafc",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Co si vzít — souhrn</h2>
        <ul>
          {INSPIRATION_TAKEAWAYS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <div style={{ display: "grid", gap: "1rem" }}>
        {INSPIRATIONS.map((g) => (
          <article
            key={g.url}
            style={{
              border: "1px solid var(--border)",
              borderLeft: g.closest ? "4px solid var(--accent)" : undefined,
              borderRadius: 8,
              padding: "1rem",
            }}
          >
            <header
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                gap: "1rem",
                flexWrap: "wrap",
              }}
            >
              <h2 style={{ margin: 0 }}>
                {g.name}{" "}
                <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: "0.9rem" }}>
                  {g.location}
                </span>
                {g.closest && (
                  <span style={{ marginLeft: 8, fontSize: "0.7rem", background: "var(--accent)", color: "white", padding: "2px 6px", borderRadius: 4 }}>
                    nejblíž našemu konceptu
                  </span>
                )}
                {g.designBenchmark && (
                  <span style={{ marginLeft: 8, fontSize: "0.7rem", background: "var(--muted)", color: "white", padding: "2px 6px", borderRadius: 4 }}>
                    designová inspirace
                  </span>
                )}
              </h2>
              <a href={g.url} target="_blank" rel="noopener noreferrer">
                otevřít web ↗
              </a>
            </header>

            <dl style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.35rem 1rem", margin: "0.75rem 0 0" }}>
              <Term label="Přístup" value={g.access} />
              <Term label="Rezervace" value={g.booking} />
              <Term label="Platba" value={g.payment} />
              <Term label="Frontend & formuláře" value={g.frontend} />
            </dl>

            <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong style={{ fontSize: "0.85rem" }}>Funkce</strong>
                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
                  {g.features.map((f) => (
                    <li key={f} style={{ fontSize: "0.9rem" }}>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong style={{ fontSize: "0.85rem" }}>Co si vzít</strong>
                <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem" }}>
                  {g.ideas.map((i) => (
                    <li key={i} style={{ fontSize: "0.9rem" }}>
                      {i}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>
        ))}
      </div>

      <p style={{ color: "var(--muted)", marginTop: "1.5rem", fontSize: "0.85rem" }}>
        Plný rozbor se zdroji: <code>docs/INSPIRATIONS.md</code>.
      </p>
    </div>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ fontWeight: 600, fontSize: "0.85rem" }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: "0.9rem" }}>{value}</dd>
    </>
  );
}
