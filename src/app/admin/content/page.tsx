import { cms } from "@/lib/services";
import { BlockForm } from "./block-form";

export const metadata = { title: "Obsah webu" };

/**
 * CMS admin — the "redakční systém". Lists every content block grouped by
 * section with an inline editor, plus a form to add new blocks. Media/file
 * management and pages get their own sub-sections as the public site is built.
 */
export default async function ContentPage() {
  const blocks = await cms.listBlocks();
  const groups = groupBy(blocks, (b) => b.groupName ?? "ostatní");

  return (
    <div>
      <h1>Obsah webu</h1>
      <p style={{ color: "var(--muted)" }}>
        Upravte jakýkoli text na webu. Změny se projeví okamžitě po uložení.
      </p>

      {Object.entries(groups).map(([group, items]) => (
        <section key={group} style={{ marginTop: "1.5rem" }}>
          <h2>{group}</h2>
          {items.map((block) => (
            <details
              key={`${block.key}:${block.locale}`}
              style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", marginBottom: "0.75rem" }}
            >
              <summary>
                <strong>{block.label ?? block.key}</strong>{" "}
                <code style={{ color: "var(--muted)" }}>{block.key}</code>
              </summary>
              <div style={{ marginTop: "0.75rem" }}>
                <BlockForm block={block} />
              </div>
            </details>
          ))}
        </section>
      ))}

      <section style={{ marginTop: "2rem", maxWidth: 520 }}>
        <h2>Přidat nový blok obsahu</h2>
        <BlockForm />
      </section>
    </div>
  );
}

/** Small local group-by helper (kept inline; the shared helpers are for cross-cutting use). */
function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}
