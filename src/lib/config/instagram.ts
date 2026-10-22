import { z } from "zod";

export const INSTAGRAM_USERNAME = "navi_plzen";
export const INSTAGRAM_PROFILE_URL = `https://www.instagram.com/${INSTAGRAM_USERNAME}/`;
export const INSTAGRAM_ENABLED_KEY = "features.instagram_feed";
export const INSTAGRAM_CACHE_TAG = "instagram-feed";
export const INSTAGRAM_SYNC_MINUTES = 30;
export const INSTAGRAM_MAX_POSTS = 12;
export const INSTAGRAM_CALLBACK_PATH = "/api/admin/instagram/callback";
export const INSTAGRAM_COOKIE = "navi-instagram-connect";

export const instagramEnabledSchema = z.object({ enabled: z.boolean() });
export const instagramVisibilitySchema = z.object({
  id: z.string().regex(/^\d{1,30}$/),
  hidden: z.boolean(),
});
export type InstagramPost = {
  id: string;
  permalink: string;
  caption: string;
  kind: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  publishedAt: string;
  hidden: boolean;
};
export type InstagramFeed = { enabled: boolean; posts: InstagramPost[] };
export type InstagramAdminState = InstagramFeed & {
  configured: boolean;
  connected: boolean;
  username: string | null;
  expiresAt: string | null;
  lastSyncedAt: string | null;
  problem: InstagramProblem | null;
};
export const INSTAGRAM_PROBLEMS = [
  "not_configured",
  "authorization",
  "wrong_account",
  "provider",
  "busy",
  "invalid_state",
  "denied",
  "image",
] as const;
export type InstagramProblem = (typeof INSTAGRAM_PROBLEMS)[number];
export function instagramProblemText(problem: InstagramProblem) {
  const labels: Record<InstagramProblem, string> = {
    not_configured:
      "Propojení zatím není připravené. Je potřeba dokončit nastavení aplikace Instagramu.",
    authorization:
      "Propojení vypršelo nebo Instagram odebral přístup. Propojte účet znovu.",
    wrong_account:
      "Vyberte profesionální účet @navi_plzen. Jiný účet se na tento web nepřipojí.",
    provider:
      "Instagram teď neodpovídá. Poslední načtené příspěvky zůstávají zachované; zkuste obnovu později.",
    busy: "Obnova právě probíhá. Za chvíli obnovte tento přehled.",
    invalid_state:
      "Platnost připojení vypršela. Spusťte propojení znovu z administrace.",
    denied: "Připojení nebylo dokončené. Původní nastavení se nezměnilo.",
    image: "Náhled příspěvku se nepodařilo načíst.",
  };
  return labels[problem];
}

/** Media links and source images are data from a provider, never arbitrary fetch targets. */
export function isInstagramPermalink(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      ["www.instagram.com", "instagram.com"].includes(u.hostname) &&
      !u.username &&
      !u.password &&
      !u.port &&
      /^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname)
    );
  } catch {
    return false;
  }
}
export function isInstagramImageUrl(value: string) {
  try {
    const u = new URL(value);
    return (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      !u.port &&
      ["cdninstagram.com", "fbcdn.net"].some((domain) =>
        u.hostname.endsWith(`.${domain}`),
      )
    );
  } catch {
    return false;
  }
}
