/** Match a navigation item by complete URL segment, never by a partial name. */
export function isNavigationItemActive(pathname: string, href: string) {
  if (pathname === href) return true;
  return href !== "/admin" && pathname.startsWith(`${href}/`);
}
