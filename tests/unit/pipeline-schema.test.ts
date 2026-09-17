import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { getTableConfig } from "drizzle-orm/pg-core";
import { reservationPipeline } from "../../src/lib/db/schema";

test("pipeline steps are unique per reservation so re-initialisation is idempotent", async () => {
  const { indexes } = getTableConfig(reservationPipeline);
  const unique = indexes.find(
    (index) => index.config.name === "reservation_pipeline_step_uidx",
  );
  assert.ok(unique, "unique index on (reservation_id, step) is declared");
  assert.equal(unique.config.unique, true);
  assert.deepEqual(
    unique.config.columns.map((column) =>
      "name" in column ? column.name : String(column),
    ),
    ["reservation_id", "step"],
  );

  // The migration that creates the index must exist and dedupe before adding it.
  const migration = await readFile(
    "drizzle/20260916100000_pipeline_step_unique.sql",
    "utf8",
  );
  assert.match(migration, /DELETE FROM public\.reservation_pipeline/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX reservation_pipeline_step_uidx\s+ON public\.reservation_pipeline \(reservation_id, step\)/,
  );
});
