/** Destructive synthetic benchmark: accepts only the explicitly named local _test database. */
import {
  databaseReady,
  resetDatabase,
  rows,
  seedProfile,
  stopEverything,
} from "../tests/integration/setup";
import { db } from "../src/lib/db";
import assert from "node:assert/strict";
import { getSlotsForRange } from "../src/lib/services/slots";
import { checkAvailability } from "../src/lib/services/availability";
import { getStats } from "../src/lib/services/stats";
import { getFinanceOverview } from "../src/lib/services/finance";
import { listCustomerOrders } from "../src/lib/services/customer-orders";
import { listRecent } from "../src/lib/services/messages";
import { getTomorrowOverview } from "../src/lib/services/tomorrow";
if (!databaseReady)
  throw new Error("Benchmark requires an isolated local test database.");
const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const now = new Date("2026-09-30T10:00:00Z");
try {
  await resetDatabase();
  await seedProfile({
    id: owner,
    email: "profile@example.test",
    fullName: "Synthetic Profile",
  });
  await rows(
    `insert into reservation (user_id,starts_at,ends_at,status,price_cents,created_at)
    select case when n%10=0 then $1::uuid else null end,
      '2020-01-01'::timestamptz+n*interval '75 minutes',
      '2020-01-01'::timestamptz+(n+1)*interval '75 minutes',
      'completed',22900,'2020-01-01'::timestamptz+n*interval '75 minutes'
    from generate_series(0,49999) n`,
    [owner],
  );
  await rows(`insert into reservation (starts_at,ends_at,status,price_cents)
    select '2030-10-01'::timestamptz+n*interval '75 minutes', '2030-10-01'::timestamptz+(n+1)*interval '75 minutes','confirmed',22900
    from generate_series(0,499) n`);
  await rows(`insert into payment (type,status,amount_cents,provider,provider_environment,paid_at)
    select 'one_off','succeeded',22900,'comgate','false','2020-01-01'::timestamptz+n*interval '75 minutes' from generate_series(0,49999) n`);
  await rows(`insert into message_delivery (channel,kind,status,recipient,created_at)
    select 'email','reservation_confirmation','sent','synthetic@example.test','2020-01-01'::timestamp+n*interval '75 minutes' from generate_series(0,49999) n`);
  await rows("analyze reservation; analyze payment; analyze message_delivery");
  const fixture = async () =>
    (
      await rows<{ reservations: number; payments: number; messages: number }>(
        "select (select count(*)::int from reservation) as reservations,(select count(*)::int from payment) as payments,(select count(*)::int from message_delivery) as messages",
      )
    )[0]!;
  const expected = { reservations: 50500, payments: 50000, messages: 50000 };
  assert.deepEqual(await fixture(), expected);
  const reports = [];
  for (const [name, run] of [
    ["slots-month", () => getSlotsForRange("2030-10-01", "2030-11-01", now)],
    [
      "availability",
      () =>
        checkAvailability(
          new Date("2030-10-01T10:00:00Z"),
          new Date("2030-10-01T11:00:00Z"),
        ),
    ],
    ["statistics", () => getStats(now)],
    ["finance", () => getFinanceOverview("7d", now)],
    ["customer-orders", () => listCustomerOrders(owner, 1)],
    ["messages", () => listRecent()],
    ["tomorrow", () => getTomorrowOverview(now)],
  ] as const) {
    const statements: { query: string; parameters: readonly unknown[] }[] = [];
    const previous = db.$client.options.debug;
    db.$client.options.debug = (_connection, query, parameters) =>
      // postgres.js serializes its parameter array in place after debug.
      // Retain the original booleans/types for faithful EXPLAIN parameters.
      statements.push({ query, parameters: [...parameters] });
    const started = performance.now();
    try {
      await run();
    } finally {
      db.$client.options.debug = previous;
    }
    const ms = Math.round(performance.now() - started);
    const plans = [];
    for (const statement of statements) {
      if (
        !/^\s*(select|with)\b/i.test(statement.query) ||
        /\b(insert|update|delete|truncate)\b/i.test(statement.query)
      )
        continue;
      // Values are entirely synthetic and remain in memory; output contains
      // execution plans without request/session/provider credentials.
      const plan = await rows<{ "QUERY PLAN": unknown }>(
        `explain (analyze,buffers,format json) ${statement.query}`,
        [...statement.parameters],
      );
      plans.push({ query: statement.query, plan: plan[0]?.["QUERY PLAN"] });
    }
    reports.push({ name, queries: statements.length, ms, plans });
  }
  assert.deepEqual(await fixture(), expected);
  console.log(
    JSON.stringify(
      {
        fixture: {
          reservations: 50500,
          payments: 50000,
          messages: 50000,
          ownerPurchases: 5000,
        },
        reports,
      },
      null,
      2,
    ),
  );
} finally {
  await stopEverything();
}
