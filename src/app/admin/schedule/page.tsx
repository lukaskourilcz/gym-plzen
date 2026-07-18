import { schedule } from "@/lib/services";
import { addMinutes } from "@/lib/helpers/datetime";
import { formatDateTime } from "@/lib/helpers/format";
import { PageHeader } from "@/components/admin/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BlockedSlotForm, DeleteBlockButton, OpeningHoursRow, ShowerMinutesForm } from "./schedule-forms";

export const metadata = { title: "Otevírací doba a bloky" };
export const dynamic = "force-dynamic";

/** Weekly opening hours + one-off blocked slots (maintenance, holidays). */
export default async function SchedulePage() {
  const now = new Date();
  const [hours, blocks, showerMinutes] = await Promise.all([
    schedule.listOpeningHours(),
    schedule.listBlockedSlots(now, addMinutes(now, 60 * 24 * 90)),
    schedule.getShowerMinutes(),
  ]);
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  return (
    <div>
      <PageHeader title="Otevírací doba a bloky" />

      <section>
        <h2 className="mb-1 text-lg font-semibold">Týdenní otevírací doba</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Sloty jsou vždy celé hodiny (např. 13:00–14:00). Výchozí provoz je denně 05:00–21:00.
        </p>
        {Array.from({ length: 7 }, (_, day) => (
          <OpeningHoursRow key={day} dayOfWeek={day} hours={byDay.get(day)} />
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-1 text-lg font-semibold">Doba na sprchu</h2>
        <p className="mb-3 max-w-2xl text-sm text-muted-foreground">
          O kolik minut po skončení tréninku ještě platí vstupní kód, aby se člen mohl osprchovat.
          Neblokuje další slot — další člen může začít trénovat, zatímco se předchozí sprchuje.
        </p>
        <ShowerMinutesForm current={showerMinutes} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-semibold">Blokované termíny</h2>
        <BlockedSlotForm />

        <div className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Začátek</TableHead>
                <TableHead>Konec</TableHead>
                <TableHead>Důvod</TableHead>
                <TableHead>Poznámka</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>{formatDateTime(b.startsAt)}</TableCell>
                  <TableCell>{formatDateTime(b.endsAt)}</TableCell>
                  <TableCell>{b.reason}</TableCell>
                  <TableCell>{b.note ?? "—"}</TableCell>
                  <TableCell>
                    <DeleteBlockButton id={b.id} />
                  </TableCell>
                </TableRow>
              ))}
              {blocks.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    Žádné blokované termíny.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
