import { reservations } from "@/lib/services";
import { formatDateTime, formatMoney } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import { DemoBanner } from "@/components/admin/demo-banner";
import { ReservationForm } from "./reservation-form";
import { CancelButton } from "./cancel-button";

export const metadata = { title: "Rezervace" };
export const dynamic = "force-dynamic";

/**
 * Reservations admin: manual booking form + a list of recent reservations with
 * an inline cancel control.
 */
export default async function ReservationsPage() {
  let rows = await reservations.listRecent(100);
  const demo = rows.length === 0;
  if (demo) rows = (await loadDemoData()).reservations;

  return (
    <div>
      <h1>Rezervace</h1>
      {demo && <DemoBanner />}

      <section
        style={{
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "1rem",
          maxWidth: 480,
          marginBottom: "2rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Nová rezervace (ručně)</h2>
        <ReservationForm />
      </section>

      <h2>Poslední rezervace</h2>
      <table>
        <thead>
          <tr>
            <th>Začátek</th>
            <th>Konec</th>
            <th>Kontakt</th>
            <th>Cena</th>
            <th>Stav</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>{formatDateTime(r.startsAt)}</td>
              <td>{formatDateTime(r.endsAt)}</td>
              <td>{r.contactName ?? r.contactEmail ?? "—"}</td>
              <td>{r.priceCents != null ? formatMoney(r.priceCents, r.currency) : "členství"}</td>
              <td>{r.status}</td>
              <td>
                {!demo && r.status !== "cancelled" && <CancelButton reservationId={r.id} />}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6}>Zatím žádné rezervace.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
