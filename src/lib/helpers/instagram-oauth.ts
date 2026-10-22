import { publicEnv } from "@/lib/public-env";
import { INSTAGRAM_CALLBACK_PATH } from "@/lib/config/instagram";

/** OAuth and return locations are fixed; the request cannot supply an open redirect. */
export function instagramOrigin(requestUrl: string) {
  if (process.env.E2E_LOCAL_AUTH === "true") {
    const test = new URL(requestUrl);
    if (["localhost", "127.0.0.1", "[::1]"].includes(test.hostname))
      return test.origin;
  }
  return new URL(publicEnv.NEXT_PUBLIC_APP_URL).origin;
}
export function instagramRedirectUri(requestUrl: string) {
  return `${instagramOrigin(requestUrl)}${INSTAGRAM_CALLBACK_PATH}`;
}
export function instagramAdminReturn(requestUrl: string, result: string) {
  const url = new URL("/admin/content", instagramOrigin(requestUrl));
  url.search = new URLSearchParams({
    section: "instagram",
    instagram: result,
  }).toString();
  return url;
}
