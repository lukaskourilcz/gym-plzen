import type { Metadata } from "next";

/**
 * Meta proves domain ownership by reading a tag from the site's `<head>`.
 * The DNS zone for navigym.cz lives at the registrar, so this tag is the
 * method the deployment can satisfy on its own. No code means no tag.
 */
export function siteVerification(
  metaDomainCode: string | undefined,
  googleSiteCode?: string,
): Metadata["verification"] {
  const code = metaDomainCode?.trim();
  const google = googleSiteCode
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!code && !google?.length) return undefined;
  return {
    ...(code ? { other: { "facebook-domain-verification": code } } : {}),
    ...(google?.length ? { google } : {}),
  };
}
