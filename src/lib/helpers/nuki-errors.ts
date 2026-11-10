import { nukiApiFailure, NUKI_HEALTH_DESCRIPTIONS } from "./nuki-diagnostics";

export const NUKI_READ_FAILURES = {
  nuki_api_unavailable: NUKI_HEALTH_DESCRIPTIONS.api_unavailable,
  nuki_access_denied: NUKI_HEALTH_DESCRIPTIONS.access_denied,
  nuki_rate_limited: NUKI_HEALTH_DESCRIPTIONS.rate_limited,
  nuki_connection_unknown: NUKI_HEALTH_DESCRIPTIONS.connection_unknown,
  nuki_response_unknown: NUKI_HEALTH_DESCRIPTIONS.state_unknown,
} as const;
export type NukiReadFailureReason = keyof typeof NUKI_READ_FAILURES;
export function isNukiReadFailureReason(
  reason: unknown,
): reason is NukiReadFailureReason {
  return (
    typeof reason === "string" && Object.hasOwn(NUKI_READ_FAILURES, reason)
  );
}

/** Safe diagnostic only: never retain a provider body, token, PIN or request URL. */
export class NukiReadError extends Error {
  constructor(readonly reason: NukiReadFailureReason) {
    super(reason);
    this.name = "NukiReadError";
  }
}
export function nukiReadError(error: unknown): NukiReadError {
  if (error instanceof NukiReadError) return error;
  const failure = nukiApiFailure(error).failure;
  return new NukiReadError(
    failure === "access_denied"
      ? "nuki_access_denied"
      : failure === "rate_limited"
        ? "nuki_rate_limited"
        : failure === "unavailable"
          ? "nuki_api_unavailable"
          : failure === "network"
            ? "nuki_connection_unknown"
            : "nuki_response_unknown",
  );
}
