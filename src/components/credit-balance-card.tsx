import { formatMoney } from "@/lib/helpers/format";

export function CreditBalanceCard({
  availableCents,
}: {
  availableCents: number;
}) {
  if (availableCents <= 0) return null;
  return (
    <section
      aria-label="Tvoje kredity"
      className="rounded-lg border border-border bg-card p-7"
    >
      <h2 className="text-xl font-bold">
        Tvoje kredity:{" "}
        <span className="whitespace-nowrap tabular-nums">
          {formatMoney(availableCents)}
        </span>
      </h2>
    </section>
  );
}
