import { spawnSync } from "node:child_process";
import { requireTestDatabaseUrl } from "../tests/helpers/test-database";

// Apply the same loopback/test-database gate as every integration test.
const database = requireTestDatabaseUrl();
const result = spawnSync(
  "psql",
  [
    database,
    "-v",
    "ON_ERROR_STOP=1",
    "-f",
    "tests/integration/payment-reliability.sql",
  ],
  { stdio: "inherit" },
);
if (result.error) throw new Error("SQL checks could not start psql.");
process.exitCode = result.status ?? 1;
