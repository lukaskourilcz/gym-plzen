/**
 * Remove the retired public brand from CMS-authored customer copy.
 *
 * Real compatibility addresses on `namastegym.cz` stay intact until their
 * redirects and mail DNS move; they are addresses, not the displayed brand.
 */
const PROTECTED_ADDRESS = /namastegym\.cz/gi;
const LEGACY_BRAND = /namast[eé]/gi;

const EXTERNAL_REPLACEMENTS: ReadonlyArray<readonly [string, string]> = [
  ["namaste_plzen", "navi_plzen"],
  [
    "https://www.facebook.com/profile.php?id=61592125101750",
    "https://www.facebook.com/profile.php?id=61594273731288",
  ],
];

function rebrandSegment(value: string): string {
  let next = value;
  for (const [from, to] of EXTERNAL_REPLACEMENTS) {
    next = next.replaceAll(from, to);
  }
  return next.replace(LEGACY_BRAND, "NAVI");
}

/** Rebrand display text while preserving real legacy domain addresses. */
export function rebrand(value: string): string {
  let result = "";
  let cursor = 0;
  for (const match of value.matchAll(PROTECTED_ADDRESS)) {
    result += rebrandSegment(value.slice(cursor, match.index));
    result += match[0];
    cursor = match.index + match[0].length;
  }
  return result + rebrandSegment(value.slice(cursor));
}
