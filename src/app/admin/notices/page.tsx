import { requireAdmin } from "@/lib/auth/guards";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { defaultPublicNotices } from "@/lib/config/public-notices";
import { loadPublicNotices } from "@/lib/services/public-notices";
import { PageHeader } from "@/components/admin/page-header";
import { NoticesEditor } from "./notices-editor";

export const metadata = { title: "Upozornění" };
export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  await requireAdmin();
  const notices = (await hasDemoAdminSession())
    ? defaultPublicNotices()
    : await loadPublicNotices();
  return (
    <div>
      <PageHeader title="Upozornění" />
      <NoticesEditor initial={notices} />
    </div>
  );
}
