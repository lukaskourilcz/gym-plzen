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
  "permissions",
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
    permissions:
      "Nastavte v Meta přístup pouze ke čtení profilu a příspěvků (instagram_basic).",
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

/** Synchronisation re-exchanges a renewable token once it is this close to expiry. */
export const INSTAGRAM_RENEWAL_WINDOW_DAYS = 14;
const INSTAGRAM_URGENT_DAYS = 3;
function czechCount(n: number, one: string, few: string, many: string) {
  return `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`;
}
export type InstagramExpiryCountdown = {
  tone: "ok" | "renewal" | "urgent" | "expired";
  /** Nominative remaining time, e.g. "59 dní 23 hodin"; null once expired. */
  remaining: string | null;
};
/** Remaining access time for the admin, rounded down to the two largest units. */
export function instagramExpiryCountdown(
  expiresAt: string,
  now: number,
): InstagramExpiryCountdown {
  const left = new Date(expiresAt).getTime() - now;
  if (!Number.isFinite(left) || left <= 0)
    return { tone: "expired", remaining: null };
  const minutes = Math.floor(left / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const day = (n: number) => czechCount(n, "den", "dny", "dní");
  const hour = (n: number) => czechCount(n, "hodina", "hodiny", "hodin");
  const minute = (n: number) => czechCount(n, "minuta", "minuty", "minut");
  const remaining =
    days > 0
      ? [day(days), hours > 0 ? hour(hours) : null].filter(Boolean).join(" ")
      : hours > 0
        ? [hour(hours), rest > 0 ? minute(rest) : null]
            .filter(Boolean)
            .join(" ")
        : minute(Math.max(rest, 1));
  const tone =
    left < INSTAGRAM_URGENT_DAYS * 86400_000
      ? "urgent"
      : left < INSTAGRAM_RENEWAL_WINDOW_DAYS * 86400_000
        ? "renewal"
        : "ok";
  return { tone, remaining };
}
