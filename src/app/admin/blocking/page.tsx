import { requireAdmin } from "@/lib/auth/guards";
import { PageHeader } from "@/components/admin/page-header";
import { Pagination } from "@/components/ui/pagination";
import { dateKeyInTimeZone } from "@/lib/helpers/datetime";
import { BLOCK_APPLICATION_PAGE_SIZE } from "@/lib/config/blocking";
import {
  listBlockApplications,
  listBlockTemplates,
  loadBlockingHours,
} from "@/lib/services/blocking";
import { BlockingManager } from "./blocking-manager";
export const metadata = { title: "Blokování termínů" };
export const dynamic = "force-dynamic";
export default async function BlockingPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireAdmin();
  const rawPage = Number((await searchParams).page ?? 1);
  const page =
    Number.isInteger(rawPage) && rawPage > 0 && rawPage < 10000 ? rawPage : 1;
  const [templates, applications, hours] = await Promise.all([
    listBlockTemplates(),
    listBlockApplications(page),
    loadBlockingHours(),
  ]);
  return (
    <div>
      <PageHeader
        title="Blokování termínů"
        description="Vyberte sloty v šabloně a použijte je na dny nebo období. Otevírací doba ani zakoupené rezervace se nemění."
      />
      <BlockingManager
        templates={templates.map((row) => ({
          ...row,
          updatedAt: row.updatedAt.toISOString(),
        }))}
        applications={applications
          .slice(0, BLOCK_APPLICATION_PAGE_SIZE)
          .map((row) => ({
            id: row.id,
            snapshot: row.snapshot,
            createdAt: row.createdAt.toISOString(),
            cancelledAt: row.cancelledAt?.toISOString() ?? null,
          }))}
        hours={hours}
        today={dateKeyInTimeZone(new Date())}
      />
      <Pagination
        page={page}
        hasNext={applications.length > BLOCK_APPLICATION_PAGE_SIZE}
        hrefForPage={(value) =>
          `/admin/blocking?page=${value}#blocking-history`
        }
        label="Použité blokace"
      />
    </div>
  );
}
