import { schedule } from "@/lib/services";
import { addMinutes } from "@/lib/helpers/datetime";
import { formatDateTime } from "@/lib/helpers/format";
import {
  BlockedSlotForm,
  DeleteBlockButton,
  OpeningHoursRow,
  ShowerMinutesForm,
} from "./schedule-forms";

export const metadata = { title: "Otevírací doba a bloky" };

/**
 * Schedule admin — weekly opening hours plus one-off blocked slots (maintenance,
 * holidays). The availability service reads both to decide what's bookable.
 */
export default async function SchedulePage() {
  const now = new Date();
  const [hours, blocks, showerMinutes] = await Promise.all([
    schedule.listOpeningHours(),
    schedule.listBlockedSlots(now, addMinutes(now, 60 * 24 * 90)), // next ~90 days
    schedule.getShowerMinutes(),
  ]);
  const byDay = new Map(hours.map((h) => [h.dayOfWeek, h]));

  return (
    <div>
      <h1>Otevírací doba a bloky</h1>

      <section>
        <h2>Týdenní otevírací doba</h2>
        <p style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
          Sloty jsou vždy celé hodiny (např. 13:00–14:00). Výchozí provoz je
          denně 05:00–21:00.
        </p>
        {Array.from({ length: 7 }, (_, day) => (
          <OpeningHoursRow key={day} dayOfWeek={day} hours={byDay.get(day)} />
        ))}
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Doba na sprchu</h2>
        <p style={{ color: "var(--muted-foreground)", fontSize: "0.9rem" }}>
          O kolik minut po skončení tréninku ještě platí vstupní kód, aby se
          člen mohl osprchovat. Neblokuje další slot — další člen může začít
          trénovat, zatímco se předchozí sprchuje.
        </p>
        <ShowerMinutesForm current={showerMinutes} />
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Blokované termíny</h2>
        <BlockedSlotForm />

        <table style={{ marginTop: "1rem" }}>
          <thead>
            <tr>
              <th>Začátek</th>
              <th>Konec</th>
              <th>Důvod</th>
              <th>Poznámka</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {blocks.map((b) => (
              <tr key={b.id}>
                <td>{formatDateTime(b.startsAt)}</td>
                <td>{formatDateTime(b.endsAt)}</td>
                <td>{b.reason}</td>
                <td>{b.note ?? "—"}</td>
                <td>
                  <DeleteBlockButton id={b.id} />
                </td>
              </tr>
            ))}
            {blocks.length === 0 && (
              <tr>
                <td colSpan={5}>Žádné blokované termíny.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
