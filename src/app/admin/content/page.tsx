import { requireAdmin } from "@/lib/auth/guards";
import { loadSiteContent, SITE_DEFAULTS } from "@/lib/content/site";
import { PageHeader } from "@/components/admin/page-header";
import { ContentEditor } from "./content-editor";
import { hasDemoAdminSession } from "@/lib/auth/demo";

export const metadata = { title: "Obsah webu" };
export const dynamic = "force-dynamic";

/** Client-safe content editor. It shows rendered values, never internal CMS keys. */
export default async function ContentPage() {
  await requireAdmin();
  const demo = await hasDemoAdminSession();
  const content = await loadSiteContent("cs", {
    strict: !demo,
    defaultsOnly: demo,
  });
  const values = Object.fromEntries(
    Object.keys(SITE_DEFAULTS).map((key) => [
      key,
      content.raw(key as keyof typeof SITE_DEFAULTS),
    ]),
  ) as Record<string, string>;

  const assets: Record<string, string> = {
    "branding.hero_image_url":
      content.heroImageUrl || "/images/photos/hero.webp",
    "branding.hero_image_alt":
      content.heroImageAlt || "Interiér NAVI Private Gym",
    "branding.sections_image_url":
      content.sectionsImageUrl || "/images/photos/sections.webp",
    ...Object.fromEntries(
      content.galleryImageUrls.map((url, i) => [
        `branding.gallery_${i + 1}_url`,
        url || `/images/photos/gallery-${i + 1}.webp`,
      ]),
    ),
    ...Object.fromEntries(
      content.zoneImageUrls.map((url, i) => [
        `branding.zone_${i + 1}_url`,
        url || `/images/photos/zone-${i + 1}.webp`,
      ]),
    ),
  };

  return (
    <div>
      <PageHeader
        title="Obsah webu"
        description="Vyberte část webu podle náhledu. Na jednom místě upravíte její texty i fotografie a najdete související nastavení."
      />
      <ContentEditor values={values} assets={assets} />
    </div>
  );
}
