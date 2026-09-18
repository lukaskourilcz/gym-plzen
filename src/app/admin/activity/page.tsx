import Link from "next/link";
import { activity } from "@/lib/services";
import { formatDateTime } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { pageFromParam, splitPage } from "@/lib/helpers/pagination";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { ActivityActor } from "@/components/admin/activity-actor";

export const metadata = { title: "Historie akcí" };
export const dynamic = "force-dynamic";

/**
 * What happened, in order: reservations confirmed, cancelled or moved,
 * payments settled, and every change an administrator made. Each row says
 * who did it and links to the member it concerns.
 *
 * The log only grows, so it is read one page at a time, like the customer's
 * order history. One row beyond the page is what tells us there is another
 * page; the rest of that row is not rendered.
 */
export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const page = pageFromParam(params.page);
  const demo = await hasDemoAdminSession();
  const { rows, hasNext } = splitPage(
    demo ? [] : await activity.listPage(page),
    activity.ACTIVITY_PAGE_SIZE,
  );

  return (
    <div>
      <PageHeader
        title="Historie akcí"
        description="Potvrzené, zrušené a přesunuté rezervace, přijaté platby a změny provedené v administraci. Nejnovější nahoře."
      />
      <Table label="Historie akcí">
        <TableHeader>
          <TableRow>
            <TableHead>Čas</TableHead>
            <TableHead>Kdo</TableHead>
            <TableHead>Akce</TableHead>
            <TableHead>Popis</TableHead>
            <TableHead>Člen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="whitespace-nowrap">
                {formatDateTime(entry.occurredAt)}
              </TableCell>
              <TableCell>
                <ActivityActor entry={entry} />
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {activity.activityActionLabel(entry.action)}
                </Badge>
              </TableCell>
              <TableCell>{entry.summary}</TableCell>
              <TableCell>
                {entry.memberId ? (
                  <Link
                    href={`/admin/members/${entry.memberId}`}
                    className="inline-flex min-h-11 items-center font-bold text-accent-foreground hover:underline"
                  >
                    Profil člena
                    <span className="sr-only">
                      , záznam z {formatDateTime(entry.occurredAt)}
                    </span>
                  </Link>
                ) : (
                  <span className="text-muted-foreground">
                    {entry.actorType === "customer" ? "Host" : "Bez člena"}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                {page === 1
                  ? "Zatím žádné zaznamenané akce."
                  : "Na této stránce už žádné akce nejsou."}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <Pagination
        page={page}
        hasNext={hasNext}
        hrefForPage={(next) => `/admin/activity?page=${next}`}
        label="Stránkování historie akcí"
      />
    </div>
  );
}
