import { OperationBusyError } from "./operation-busy";
import { pgErrorCode } from "./pg-error";

/** Diagnostic categories only: never instructions to repeat a payment/write. */
export function operationalFailure(error: unknown) {
  const databaseState = pgErrorCode(error);
  const kind =
    error instanceof OperationBusyError
      ? "operation_busy"
      : databaseState === "57014"
        ? "database_statement_timeout"
        : databaseState === "55P03"
          ? "database_lock_timeout"
          : databaseState?.startsWith("08")
            ? "database_connection"
            : error instanceof Error &&
                ["AbortError", "TimeoutError"].includes(error.name)
              ? "provider_timeout"
              : error instanceof Error &&
                  error.message === "Payment status unavailable"
                ? "payment_status_unavailable"
                : error instanceof Error &&
                    [
                      "Payment environment mismatch",
                      "Payment identity or amount mismatch",
                      "Payment binding changed",
                    ].includes(error.message)
                  ? "payment_binding_mismatch"
                  : "unexpected";
  return { kind, ...(databaseState ? { databaseState } : {}) };
}
