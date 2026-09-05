/** Accept only same-origin absolute paths for authentication return targets. */
export function safeInternalPath(
  value: string | null | undefined,
  fallback = "/account",
) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\r\n\\]/.test(value)
  ) {
    return fallback;
  }
  try {
    const url = new URL(value, "https://namaste.invalid");
    if (url.origin !== "https://namaste.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Send administrators to their workspace when login has no specific return target. */
export function postLoginDestination(
  value: string | null | undefined,
  role: string | null | undefined,
) {
  const destination = safeInternalPath(value);
  return role === "admin" && destination === "/account"
    ? "/admin"
    : destination;
}
