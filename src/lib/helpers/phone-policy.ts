import { safeInternalPath } from "@/lib/security/redirects";

export function phoneCompletionHref(next: string) {
  const destination = safeInternalPath(next);
  return `/account/telefon?next=${encodeURIComponent(destination.startsWith("/account/telefon") ? "/account" : destination)}`;
}
