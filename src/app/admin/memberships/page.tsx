import { requireAdmin } from "@/lib/auth/guards";
import { loyalty, members, pricingPeriods, slots } from "@/lib/services";
import { deriveLoyaltyStatus } from "@/lib/services/loyalty";
import {
  DEFAULT_ENTRY_PRICE_CENTS,
  FREE_ENTRY_EVERY,
} from "@/lib/config/pricing";
import { DEFAULT_BOOKING_HORIZON_DAYS } from "@/lib/config/schedule";
import { dateKeyInTimeZone, localDateTimeToDate } from "@/lib/helpers/datetime";
import { formatDate, formatMoney } from "@/lib/helpers/format";
import { loadDemoData } from "@/lib/demo/dummy";
import type { PricingPeriod } from "@/lib/db/types";
import { hasDemoAdminSession } from "@/lib/auth/demo";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookingHorizonForm } from "./booking-horizon-form";
import { EntryPriceForm } from "./entry-price-form";
import { PricingPeriodDeleteButton } from "./pricing-period-delete-button";
import { PricingPeriodForm } from "./pricing-period-form";

export const metadata = { title: "Vstupné a věrnost" };
export const dynamic = "force-dynamic";

const DEMO_PERIOD: PricingPeriod = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Říjnová akce",
  priceCents: 19_900,
  startsAt: localDateTimeToDate("2026-10-01", 0),
  endsAt: localDateTimeToDate("2026-11-01", 0),
  createdByAdminId: null,
  createdAt: new Date("2026-09-05T00:00:00Z"),
  updatedAt: new Date("2026-09-05T00:00:00Z"),
};

function lastIncludedDate(period: PricingPeriod): Date {
  return new Date(period.endsAt.getTime() - 1);
}

function periodStatus(period: PricingPeriod, now: Date) {
  if (now < period.startsAt)
    return { label: "Naplánováno", variant: "outline" as const };
  if (now >= period.endsAt)
    return { label: "Ukončeno", variant: "muted" as const };
  return { label: "Právě platí", variant: "accent" as const };
}

/** Pricing schedule, booking horizon, and automatic loyalty overview. */
export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const [demo, query] = await Promise.all([
    hasDemoAdminSession(),
    searchParams,
  ]);
  const now = new Date();
  const [standardPriceCents, entryPrice, periods, horizonDays, liveMembers] =
    demo
      ? [DEFAULT_ENTRY_PRICE_CENTS, null, [DEMO_PERIOD], 130, []]
      : await Promise.all([
          loyalty.getStandardEntryPriceCents(),
          loyalty.getEntryPrice(now),
          pricingPeriods.listPricingPeriods(),
          slots.getBookingHorizonDays(),
          members.listMembers(200),
        ]);

  const editId = typeof query.edit === "string" ? query.edit : null;
  const editedPeriod = editId
    ? periods.find((period) => period.id === editId)
    : undefined;

  let withLoyalty: {
    member: (typeof liveMembers)[number];
    status: ReturnType<typeof deriveLoyaltyStatus>;
  }[];

  if (demo) {
    const data = await loadDemoData();
    const counts = new Map<string, number>();
    for (const reservation of data.reservations) {
      if (
        (reservation.status === "confirmed" ||
          reservation.status === "completed") &&
        reservation.userId
      ) {
        counts.set(
          reservation.userId,
          (counts.get(reservation.userId) ?? 0) + 1,
        );
      }
    }
    withLoyalty = data.members.map((member) => ({
      member,
      status: deriveLoyaltyStatus(counts.get(member.user.id) ?? 0),
    }));
  } else {
    // Two grouped queries for the whole list rather than two per member.
    const statuses = await loyalty.getLoyaltyStatusForUsers(
      liveMembers.map((member) => member.user.id),
    );
    withLoyalty = liveMembers.map((member) => ({
      member,
      status: statuses.get(member.user.id) ?? deriveLoyaltyStatus(0),
    }));
  }

  return (
    <div>
      <PageHeader
        title="Vstupné a věrnost"
        description="Standardní cena, časově omezené ceny, rozsah rezervací a automatický každý 10. vstup zdarma."
      />

      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Standardní cena</CardTitle>
            <CardDescription>
              Použije se vždy, když právě neplatí žádné cenové období.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm text-muted-foreground">
              Uloženo:{" "}
              <strong className="text-foreground">
                {formatMoney(standardPriceCents)}
              </strong>
              {entryPrice?.isPromo ? (
                <>
                  . Zákazník nyní platí{" "}
                  <strong className="text-foreground">
                    {formatMoney(entryPrice.priceCents)}
                  </strong>
                  {entryPrice.periodName ? ` (${entryPrice.periodName})` : ""}
                </>
              ) : (
                ". Tato cena právě platí."
              )}
            </p>
            <EntryPriceForm currentCzk={Math.round(standardPriceCents / 100)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Jak daleko lze rezervovat</CardTitle>
            <CardDescription>
              Pro akce s pozdějšími termíny nastavte dostatečný počet dní.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookingHorizonForm
              horizonDays={horizonDays ?? DEFAULT_BOOKING_HORIZON_DAYS}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-8" id="price-periods">
        <CardHeader>
          <CardTitle>Cenová období</CardTitle>
          <CardDescription>
            Naplánujte libovolné měsíce nebo vlastní rozsahy. Období se nesmí
            překrývat; mimo ně platí standardní cena.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-8 grid gap-3">
            {periods.map((period) => {
              const status = periodStatus(period, now);
              return (
                <div
                  key={period.id}
                  className="flex flex-col gap-4 rounded-lg border border-border p-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="break-words">{period.name}</strong>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formatDate(period.startsAt)} až{" "}
                      {formatDate(lastIncludedDate(period))}
                      {" · "}
                      <strong className="text-foreground">
                        {formatMoney(period.priceCents)}
                      </strong>
                    </p>
                  </div>
                  {!demo ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        href={`/admin/memberships?edit=${period.id}#price-period-form`}
                        variant="outline"
                        size="sm"
                      >
                        Upravit
                      </Button>
                      <PricingPeriodDeleteButton id={period.id} />
                    </div>
                  ) : null}
                </div>
              );
            })}
            {periods.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">
                Zatím není naplánované žádné cenové období. Vždy platí
                standardní cena.
              </p>
            ) : null}
          </div>

          <div className="border-t border-border pt-6">
            <h3 className="mb-1 text-base font-semibold">
              {editedPeriod ? "Upravit cenové období" : "Přidat cenové období"}
            </h3>
            <p className="mb-5 text-sm text-muted-foreground">
              Datum „do“ platí včetně celého zvoleného dne v časovém pásmu
              Praha.
            </p>
            <PricingPeriodForm
              period={
                editedPeriod
                  ? {
                      id: editedPeriod.id,
                      name: editedPeriod.name,
                      priceCzk: Math.round(editedPeriod.priceCents / 100),
                      startsOn: dateKeyInTimeZone(editedPeriod.startsAt),
                      endsOn: dateKeyInTimeZone(lastIncludedDate(editedPeriod)),
                    }
                  : undefined
              }
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Automatický věrnostní program</CardTitle>
          <CardDescription>
            Každý {FREE_ENTRY_EVERY}. vstup je pro přihlášeného zákazníka
            automaticky zdarma. Bezplatný vstup má přednost před jakoukoli
            časovou cenou; rezervace hostů bez účtu se do věrnosti nepočítají.
          </CardDescription>
        </CardHeader>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Věrnostní přehled členů</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Člen</TableHead>
            <TableHead>Návštěv celkem</TableHead>
            <TableHead>V aktuálním cyklu</TableHead>
            <TableHead>Do vstupu zdarma</TableHead>
            <TableHead>Vstupů zdarma získáno</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {withLoyalty.map(({ member, status }) => (
            <TableRow key={member.user.id}>
              <TableCell>{member.user.name || member.user.email}</TableCell>
              <TableCell>{status.totalEntries}</TableCell>
              <TableCell>
                {status.positionInCycle} / {status.cadence}
              </TableCell>
              <TableCell>
                {status.nextEntryIsFree
                  ? "Další vstup zdarma"
                  : status.entriesUntilFree}
              </TableCell>
              <TableCell>{status.freeEntriesEarned}</TableCell>
            </TableRow>
          ))}
          {withLoyalty.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Zatím žádní členové.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}
