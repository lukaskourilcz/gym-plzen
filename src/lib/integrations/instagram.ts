import { z } from "zod";
import { env } from "@/lib/env";
import {
  INSTAGRAM_USERNAME,
  isInstagramImageUrl,
  isInstagramPermalink,
  type InstagramProblem,
} from "@/lib/config/instagram";

export class InstagramError extends Error {
  constructor(public readonly problem: InstagramProblem) {
    super(`Instagram: ${problem}`);
  }
}
export function instagramConfigured() {
  return Boolean(
    env.INSTAGRAM_APP_ID &&
    env.INSTAGRAM_APP_SECRET &&
    env.INSTAGRAM_TOKEN_ENCRYPTION_KEY,
  );
}
function endpoint(host: "graph" | "auth" | "login", path: string) {
  const test = env.INSTAGRAM_TEST_BASE_URL;
  if (test) {
    const u = new URL(test);
    if (
      !(
        process.env.NODE_ENV === "test" || process.env.E2E_LOCAL_AUTH === "true"
      ) ||
      !["127.0.0.1", "localhost", "[::1]"].includes(u.hostname)
    )
      throw new InstagramError("not_configured");
    return new URL(`/${host}${path}`, u);
  }
  return new URL(
    path,
    {
      graph: "https://graph.instagram.com",
      auth: "https://api.instagram.com",
      login: "https://www.instagram.com",
    }[host],
  );
}
export function instagramAuthorizationUrl(redirectUri: string, state: string) {
  if (!instagramConfigured()) throw new InstagramError("not_configured");
  const url = endpoint("login", "/oauth/authorize");
  url.search = new URLSearchParams({
    client_id: env.INSTAGRAM_APP_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_business_basic",
    state,
    enable_fb_login: "0",
    force_authentication: "1",
  }).toString();
  return url.toString();
}
export async function readLimitedBody(
  response: Pick<Response, "body" | "headers">,
  limit: number,
  problem: InstagramProblem = "provider",
) {
  if (Number(response.headers.get("content-length")) > limit)
    throw new InstagramError(problem);
  const reader = response.body?.getReader();
  if (!reader) throw new InstagramError(problem);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new InstagramError(problem);
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}
async function jsonRequest(url: URL, init: RequestInit = {}) {
  try {
    const response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
    const data: unknown = JSON.parse(
      (await readLimitedBody(response, 512_000)).toString("utf8"),
    );
    const errorCode = (data as { error?: { code?: number } })?.error?.code;
    if (response.status === 401 || errorCode === 190 || errorCode === 102)
      throw new InstagramError("authorization");
    if (!response.ok) throw new InstagramError("provider");
    return data;
  } catch (error) {
    if (error instanceof InstagramError) throw error;
    // Provider URLs can contain credentials. Never include the URL or raw error in logs/results.
    throw new InstagramError("provider");
  }
}
const tokenSchema = z.object({
  access_token: z.string().min(8).max(8192),
  expires_in: z
    .number()
    .positive()
    .max(366 * 86400),
});
function parseToken(raw: unknown) {
  const result = tokenSchema.safeParse(raw);
  if (!result.success) throw new InstagramError("authorization");
  return { token: result.data.access_token, expiresIn: result.data.expires_in };
}
export async function exchangeInstagramCode(code: string, redirectUri: string) {
  if (!instagramConfigured()) throw new InstagramError("not_configured");
  const raw = await jsonRequest(endpoint("auth", "/oauth/access_token"), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.INSTAGRAM_APP_ID!,
      client_secret: env.INSTAGRAM_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code,
    }),
  });
  const single = z.object({
    access_token: z.string().min(8).max(8192),
    user_id: z.union([z.string(), z.number()]).transform(String),
  });
  const parsed = z
    .union([
      single,
      z.object({ data: z.array(single).min(1) }).transform((v) => v.data[0]!),
    ])
    .safeParse(raw);
  if (!parsed.success) throw new InstagramError("authorization");
  const url = endpoint("graph", "/access_token");
  url.search = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: env.INSTAGRAM_APP_SECRET!,
    access_token: parsed.data.access_token,
  }).toString();
  return {
    ...parseToken(await jsonRequest(url)),
    oauthUserId: parsed.data.user_id,
  };
}
export async function refreshInstagramToken(token: string) {
  const url = endpoint("graph", "/refresh_access_token");
  url.search = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: token,
  }).toString();
  return parseToken(await jsonRequest(url));
}
function graph(path: string, token: string, fields: string) {
  const url = endpoint("graph", `/${env.INSTAGRAM_GRAPH_VERSION}${path}`);
  url.search = new URLSearchParams({ fields }).toString();
  return { url, init: { headers: { Authorization: `Bearer ${token}` } } };
}
const profileSchema = z.object({
  id: z.string().regex(/^\d+$/),
  user_id: z.union([z.string(), z.number()]).transform(String).optional(),
  username: z.string(),
  account_type: z.string().optional(),
});
export async function readInstagramProfile(token: string) {
  const { url, init } = graph("/me", token, "id,user_id,username,account_type");
  const result = profileSchema.safeParse(await jsonRequest(url, init));
  if (!result.success) throw new InstagramError("provider");
  const profile = result.data;
  if (
    profile.username.toLowerCase() !== INSTAGRAM_USERNAME ||
    (profile.account_type &&
      !["BUSINESS", "MEDIA_CREATOR", "CREATOR"].includes(profile.account_type))
  )
    throw new InstagramError("wrong_account");
  return {
    accountId: profile.user_id ?? profile.id,
    username: profile.username.toLowerCase(),
  };
}
const mediaSchema = z.object({
  id: z.string().regex(/^\d{1,30}$/),
  media_type: z.enum(["IMAGE", "VIDEO", "CAROUSEL_ALBUM"]),
  media_url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  permalink: z.string(),
  caption: z.string().max(10_000).optional(),
  timestamp: z.string(),
  children: z
    .object({
      data: z.array(
        z.object({
          media_type: z.string(),
          media_url: z.string().optional(),
          thumbnail_url: z.string().optional(),
        }),
      ),
    })
    .optional(),
});
export async function readInstagramMedia(accountId: string, token: string) {
  if (!/^\d{1,30}$/.test(accountId)) throw new InstagramError("authorization");
  const { url, init } = graph(
    `/${accountId}/media`,
    token,
    "id,media_type,media_url,thumbnail_url,permalink,caption,timestamp,children{media_type,media_url,thumbnail_url}",
  );
  url.searchParams.set("limit", "30");
  const result = z
    .object({ data: z.array(mediaSchema).max(100) })
    .safeParse(await jsonRequest(url, init));
  if (!result.success) throw new InstagramError("provider");
  return result.data.data
    .map((m) => {
      const child = m.children?.data[0];
      const imageUrl =
        m.media_type === "VIDEO"
          ? m.thumbnail_url
          : m.media_type === "CAROUSEL_ALBUM" && child?.media_type === "VIDEO"
            ? child.thumbnail_url
            : (m.media_url ?? child?.media_url);
      const publishedAt = new Date(m.timestamp);
      // A video file must never be used as an image; untrusted hosts never reach the proxy.
      if (
        !imageUrl ||
        !isInstagramImageUrl(imageUrl) ||
        !isInstagramPermalink(m.permalink) ||
        !Number.isFinite(publishedAt.getTime())
      )
        throw new InstagramError("provider");
      return {
        id: m.id,
        kind: m.media_type,
        imageUrl,
        permalink: m.permalink,
        caption: m.caption ?? "",
        publishedAt,
      };
    })
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
