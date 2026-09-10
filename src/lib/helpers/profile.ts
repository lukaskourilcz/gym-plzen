/** Only Google's HTTPS avatar hosts are accepted, never an arbitrary metadata URL. */
export function googleAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.hostname.endsWith(".googleusercontent.com")
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function splitFullName(full: string) {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
}

export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    parts.length > 1
      ? `${parts[0]![0]}${parts.at(-1)![0]}`
      : (parts[0]?.slice(0, 2) ?? "?")
  ).toLocaleUpperCase("cs-CZ");
}
