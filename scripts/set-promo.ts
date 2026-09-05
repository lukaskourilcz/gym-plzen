import { fileURLToPath } from "node:url";
import {
  BOOKING_HORIZON_SETTING_KEY,
  clampBookingHorizonDays,
} from "@/lib/config/schedule";
import { resolveEntryPrice } from "@/lib/config/pricing";
import { addDaysToDateKey, localDateTimeToDate } from "@/lib/helpers/datetime";
import { cms, loyalty, pricingPeriods, slots } from "@/lib/services";

/**
 * Configure the promotional window and the booking horizon from the command
 * line : the same two settings the administration offers, for when it is
 * quicker to run one command than to click through two forms.
 *
 * Defaults are the October promotion the client asked for: 199 Kč for the
 * whole of October, with a horizon long enough that a booking made during it
 * can still reach January. Prints what it would do and changes nothing until
 * `--write` is passed, then reads the settings back and proves the rule on
 * real dates.
 *
 *   npm run set-promo                 # dry run
 *   npm run set-promo -- --write
 *   npm run set-promo -- --write --name="Říjnová akce" --price=199 --from=2026-10-01 --to=2026-10-31 --horizon=130
 */

const DEFAULTS = {
  name: "Říjnová akce",
  price: 199,
  from: "2026-10-01",
  to: "2026-10-31",
  horizon: 130,
};

function arg(name: string): string | null {
  const hit = process.argv.find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
}

function czk(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("cs-CZ")} Kč`;
}

function pragueLabel(date: Date): string {
  return new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(date);
}

async function main() {
  const write = process.argv.includes("--write");

  const name = arg("name") ?? DEFAULTS.name;
  const price = Number(arg("price") ?? DEFAULTS.price);
  const fromDay = arg("from") ?? DEFAULTS.from;
  const toDay = arg("to") ?? DEFAULTS.to;
  const horizon = clampBookingHorizonDays(
    Number(arg("horizon") ?? DEFAULTS.horizon),
  );

  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("--price must be a positive number of crowns.");
  }

  /*
   * Store a half-open range ending at midnight after the final selected day.
   * A booking made late on the 31st still qualifies, adjacent periods can meet
   * cleanly at midnight, and October's end-of-DST is handled in Prague time.
   */
  const startsAt = localDateTimeToDate(fromDay, 0);
  const endsAt = localDateTimeToDate(addDaysToDateKey(toDay, 1), 0);
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error("--to must be after --from.");
  }

  const priceCents = Math.round(price * 100);
  const standard = await loyalty.getStandardEntryPriceCents();

  console.log(
    `${name}:`,
    czk(priceCents),
    "(standardní cena",
    czk(standard) + ")",
  );
  console.log("  od: ", pragueLabel(startsAt));
  console.log("  do: ", pragueLabel(new Date(endsAt.getTime() - 1)));
  console.log("Rozsah rezervací:", horizon, "dní");
  console.log("  (současný:", (await slots.getBookingHorizonDays()) + " dní)");

  if (!write) {
    console.log("\nDry run. Re-run with --write to apply.");
    process.exit(0);
  }

  const existing = (await pricingPeriods.listPricingPeriods()).find(
    (period) =>
      period.name === name ||
      (period.startsAt < endsAt && startsAt < period.endsAt),
  );
  await pricingPeriods.savePricingPeriod({
    id: existing?.id,
    name,
    priceCents,
    startsAt,
    endsAt,
    adminId: null,
  });
  await cms.setSetting(BOOKING_HORIZON_SETTING_KEY, horizon);

  // Read back through the same code the site uses, so the check is the rule
  // itself rather than a restatement of what was just written.
  const promo = await pricingPeriods.getActivePricingPeriod(startsAt);
  const savedHorizon = await slots.getBookingHorizonDays();
  if (!promo) throw new Error("Promo window did not save.");

  const probes: [string, Date][] = [
    ["den před akcí   ", new Date(startsAt.getTime() - 60_000)],
    ["první den akce   ", startsAt],
    ["poslední minuta  ", new Date(endsAt.getTime() - 60_000)],
    ["po konci akce    ", endsAt],
  ];
  console.log("\nUloženo. Cena podle okamžiku rezervace:");
  for (const [label, at] of probes) {
    const resolved = resolveEntryPrice({
      standardPriceCents: standard,
      periods: [promo],
      at,
    });
    console.log(`  ${label} ${pragueLabel(at)} → ${czk(resolved.priceCents)}`);
  }
  console.log(`\nRozsah rezervací: ${savedHorizon} dní.`);
  process.exit(0);
}

/* Only touch the database when run as a script. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
