import { loadSiteContent, SITE_DEFAULTS } from "@/lib/content/site";
import { PageHeader } from "@/components/admin/page-header";
import { ContentEditor } from "./content-editor";

export const metadata = { title: "Obsah webu" };
export const dynamic = "force-dynamic";

/** Client-safe content editor. It shows rendered values, never internal CMS keys. */
export default async function ContentPage() {
  const content = await loadSiteContent();
  const values = Object.fromEntries(
    Object.keys(SITE_DEFAULTS).map((key) => [
      key,
      content.get(key as keyof typeof SITE_DEFAULTS),
    ]),
  ) as Record<string, string>;

  return (
    <div>
      <PageHeader
        title="Obsah webu"
        description="Aktuální texty veřejného webu. U každého textu klikněte na ikonu úprav a změnu uložte."
      />
      <ContentEditor values={values} />
    </div>
  );
}
