import { cms } from "@/lib/services";
import { groupBy } from "@/lib/helpers/collection";
import { PageHeader } from "@/components/admin/page-header";
import { BlockForm } from "./block-form";

export const metadata = { title: "Obsah webu" };
export const dynamic = "force-dynamic";

/**
 * CMS admin : the "redakční systém". Lists content blocks grouped by section
 * with an inline editor, plus a form to add new blocks.
 */
export default async function ContentPage() {
  const blocks = await cms.listBlocks().catch(() => []);
  const groups = groupBy(blocks, (b) => b.groupName ?? "ostatní");

  return (
    <div>
      <PageHeader
        title="Obsah webu"
        description="Správa textů veřejného webu. Uložené změny se následně zobrazí návštěvníkům."
      />

      {Object.entries(groups).map(([group, items]) => (
        <section key={group} className="mt-6">
          <h2 className="mb-2 text-lg font-semibold">{group}</h2>
          {items.map((block) => (
            <details
              key={`${block.key}:${block.locale}`}
              className="mb-3 rounded-lg border border-border p-3"
            >
              <summary className="cursor-pointer">
                <strong>{block.label ?? block.key}</strong>{" "}
                <code className="text-muted-foreground">{block.key}</code>
              </summary>
              <div className="mt-3 max-w-xl">
                <BlockForm block={block} />
              </div>
            </details>
          ))}
        </section>
      ))}

      <section className="mt-8 max-w-xl">
        <h2 className="mb-3 text-lg font-semibold">Přidat nový blok obsahu</h2>
        <BlockForm />
      </section>
    </div>
  );
}
