/** Loaded only by the local E2E server: fail closed on external provider calls. */
import { Server, ServerResponse } from "node:http";
import { requireTestDatabaseUrl } from "./test-database";

if (
  process.env.DATABASE_URL !== requireTestDatabaseUrl() ||
  !process.env.E2E_RUN_ID
)
  throw new Error(
    "Local E2E requires an isolated database and run identifier.",
  );

// Readiness must identify this process, never an existing server on the port.
const actualEmit = Server.prototype.emit;
Server.prototype.emit = function (event: string, ...args: unknown[]) {
  if (event === "request" && args[1] instanceof ServerResponse)
    args[1].setHeader("x-navi-test-run", process.env.E2E_RUN_ID!);
  return Reflect.apply(actualEmit, this, [event, ...args]);
};

const actualFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
    throw new Error("Local E2E refuses external provider requests.");
  return actualFetch(input, init);
};
