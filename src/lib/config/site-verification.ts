import type { Metadata } from "next";

/**
 * Meta proves domain ownership by reading a tag from the site's `<head>`.
 * The DNS zone for navigym.cz lives at the registrar, so this tag is the
 * method the deployment can satisfy on its own. No code means no tag.
 */
export function siteVerification(
  metaDomainCode: string | undefined,
): Metadata["verification"] {
  const code = metaDomainCode?.trim();
  return code ? { other: { "facebook-domain-verification": code } } : undefined;
}
