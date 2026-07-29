/**
 * Public navigation, shared by the header and the footer "Menu" column so the
 * two can never drift apart. Anything that is NOT a header nav item (operating
 * rules, legal pages) belongs in the footer's "Informace" column instead.
 */
export const PUBLIC_NAV = [
  { href: "/#jak-to-funguje", label: "Jak to funguje" },
  { href: "/vybaveni", label: "Vybavení" },
  { href: "/#cenik", label: "Ceník" },
  { href: "/faq", label: "FAQ" },
  { href: "/#kontakt", label: "Kontakt" },
] as const;
