import assert from "node:assert/strict";
import test from "node:test";
import { operationalFailure } from "../../src/lib/helpers/operational-failure";
import { OperationBusyError } from "../../src/lib/helpers/operation-busy";
import { logger } from "../../src/lib/helpers/logger";

test("operational diagnostics retain only an allowlisted category and SQLSTATE", () => {
  const wrapped = new Error(
    "secret=test-secret customer@example.test PIN 987654",
    { cause: { code: "57014", detail: "private provider body" } },
  );
  assert.deepEqual(operationalFailure(wrapped), {
    kind: "database_statement_timeout",
    databaseState: "57014",
  });
  assert.deepEqual(operationalFailure(new OperationBusyError()), {
    kind: "operation_busy",
  });
  assert.deepEqual(
    operationalFailure(new Error("Payment identity or amount mismatch")),
    { kind: "payment_binding_mismatch" },
  );
  assert.deepEqual(operationalFailure(new Error("secret=do-not-expose")), {
    kind: "unexpected",
  });
});

test("redacted database errors retain their diagnostic state without retaining the raw cause", () => {
  const messages: string[] = [];
  const original = console.error;
  console.error = (message: string) => messages.push(message);
  try {
    logger.error(
      new Error(
        "Failed query: params customer@example.test secret=do-not-expose",
        { cause: { code: "55P03", detail: "never log this" } },
      ),
      { where: "test" },
    );
  } finally {
    console.error = original;
  }
  assert.match(messages[0]!, /"databaseState":"55P03"/);
  assert.doesNotMatch(
    messages[0]!,
    /customer@example|do-not-expose|never log this/,
  );
});
