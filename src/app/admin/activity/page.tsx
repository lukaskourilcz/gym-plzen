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
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { ActivityActor } from "@/components/admin/activity-actor";

export const metadata = { title: "Historie akcí" };
export const dynamic = "force-dynamic";

/**
 * What happened, in order: reservations confirmed, cancelled or moved,
 * payments settled, and every change an administrator made. Each row says
 * who did it and links to the member it concerns.
 */
export default async function ActivityPage() {
  const demo = await hasDemoAdminSession();
  const rows = demo ? [] : await activity.listRecent(200);

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
                Zatím žádné zaznamenané akce.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
