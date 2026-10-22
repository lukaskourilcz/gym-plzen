import { getInstagramAdminState } from "@/lib/services/instagram";
import { formatMoney } from "@/lib/helpers/format";
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
  const [content, instagram] = await Promise.all([
    loadSiteContent("cs", { strict: !demo, defaultsOnly: demo }),
    demo
      ? Promise.resolve({
          enabled: true,
          posts: [],
          configured: false,
          connected: false,
          username: null,
          expiresAt: null,
          lastSyncedAt: null,
          problem: null,
        })
      : getInstagramAdminState(),
  ]);
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
      <PageHeader title="Obsah webu" />
      <ContentEditor
        instagram={instagram}
        announcement={content.announcement}
        values={values}
        assets={assets}
        preview={{
          texts: Object.fromEntries(
            Object.keys(SITE_DEFAULTS).map((key) => [
              key,
              content.get(key as keyof typeof SITE_DEFAULTS),
            ]),
          ),
          price: formatMoney(content.entryPriceCents),
          hours: content.openingHoursLabel,
          freeEntryEvery: content.freeEntryEvery,
          isPromo: content.isPromoPrice,
        }}
      />
    </div>
  );
}
