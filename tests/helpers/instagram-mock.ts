import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import sharp from "sharp";

/** Fictional read-only provider, bound to loopback. Never imports application credentials. */
export function createInstagramMock(port: number) {
  const state = {
    username: "navi_plzen",
    accountType: "Business",
    failure: 0,
    imageType: "image/png",
    imageBroken: false,
    // Real feed posts arrive at full resolution, commonly 1080 × 1350 (4:5).
    imageSize: [1080, 1350] as [number, number],
    flatToken: false,
    unifiedScopes: ["instagram_basic"],
    unifiedExpiresAt: 0,
    unifiedBusinessId: "3333",
    unifiedAssignmentsEmpty: false,
    facebookUserLogin: false,
    profileFailure: false,
    postStatsFailure: false,
    granularTargets: ["17841427246422536"] as string[] | null,
    media: defaultMedia(),
    calls: [] as { path: string; method: string }[],
    delay: 0,
  };
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://127.0.0.1:${port}`);
    state.calls.push({ path: url.pathname, method: req.method! });
    const json = (data: unknown, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/login/oauth/authorize") {
      if (url.searchParams.get("scope") !== "instagram_business_basic")
        return json({ error: "scope" }, 400);
      const target = new URL(url.searchParams.get("redirect_uri")!);
      if (!["localhost", "127.0.0.1"].includes(target.hostname))
        return json({ error: "not_local" }, 400);
      target.searchParams.set("code", "local-test-code");
      target.searchParams.set("state", url.searchParams.get("state")!);
      res.writeHead(302, { Location: target.toString() });
      return res.end();
    }
    if (url.pathname === "/auth/oauth/access_token") {
      let body = "";
      for await (const chunk of req) body += chunk;
      const input = new URLSearchParams(body);
      if (
        req.method !== "POST" ||
        input.get("client_secret") !== "local-instagram-secret" ||
        input.get("code") !== "local-test-code"
      )
        return json({ error: { code: 190 } }, 400);
      const token = { access_token: "short-local-token", user_id: "1234" };
      return json(state.flatToken ? token : { data: [token] });
    }
    if (
      url.pathname === "/graph/access_token" ||
      url.pathname === "/graph/refresh_access_token"
    )
      return json({
        access_token: "long-local-token",
        expires_in: 60 * 86400,
        token_type: "bearer",
      });
    if (url.pathname === "/graph/v24.0/me")
      return json({
        id: "1234",
        user_id: "5678",
        username: state.username,
        account_type: state.accountType,
      });
    if (url.pathname === "/facebook-graph/v26.0/oauth/access_token") {
      if (
        req.method !== "GET" ||
        url.searchParams.get("client_id") !== "1111" ||
        url.searchParams.get("client_secret") !== "local-instagram-secret"
      )
        return json({ error: { code: 190 } }, 400);
      if (url.searchParams.get("grant_type") === "fb_exchange_token") {
        if (
          !["fb-short-token", "fb-long-token"].includes(
            url.searchParams.get("fb_exchange_token") ?? "",
          )
        )
          return json({ error: { code: 190 } }, 400);
        return json({
          access_token: "fb-long-token",
          token_type: "bearer",
          expires_in: 60 * 86400,
        });
      }
      if (
        url.searchParams.get("code") !== "local-test-code" ||
        url.searchParams.get("redirect_uri") !== "http://localhost/callback"
      )
        return json({ error: { code: 190 } }, 400);
      return json(
        state.facebookUserLogin
          ? { access_token: "fb-short-token", expires_in: 5000 }
          : { access_token: "unified-local-token" },
      );
    }
    if (url.pathname === "/facebook-graph/v26.0/debug_token") {
      const input = url.searchParams.get("input_token");
      if (
        req.headers.authorization !== "Bearer 1111|local-instagram-secret" ||
        !["unified-local-token", "fb-long-token"].includes(input ?? "")
      )
        return json({ error: { code: 190 } }, 400);
      return json({
        data: {
          app_id: "1111",
          type: input === "fb-long-token" ? "USER" : "SYSTEM_USER",
          is_valid: true,
          scopes: state.unifiedScopes,
          ...(input === "fb-long-token" && state.granularTargets
            ? {
                granular_scopes: [
                  {
                    scope: "instagram_basic",
                    target_ids: state.granularTargets,
                  },
                ],
              }
            : {}),
          expires_at: state.unifiedExpiresAt,
          data_access_expires_at: 0,
        },
      });
    }
    if (
      url.pathname.startsWith("/facebook-graph/") &&
      req.headers.authorization !==
        `Bearer ${state.facebookUserLogin ? "fb-long-token" : "unified-local-token"}`
    )
      return json({ error: { code: 190 } }, 401);
    if (url.pathname === "/facebook-graph/v26.0/me")
      return json({ id: "2222", client_business_id: state.unifiedBusinessId });
    if (url.pathname === "/facebook-graph/v26.0/me/assigned_instagram_accounts")
      return json({
        data: state.unifiedAssignmentsEmpty
          ? []
          : [
              { id: "4444", username: "other_account" },
              { id: "5678", username: state.username },
            ],
      });
    if (
      [
        "/graph/v24.0/5678",
        "/facebook-graph/v26.0/5678",
        "/facebook-graph/v26.0/17841427246422536",
      ].includes(url.pathname) &&
      url.searchParams.get("fields")?.includes("media_count")
    ) {
      if (state.profileFailure) return json({ error: { code: 2 } }, 503);
      return json({
        media_count: 98,
        followers_count: 1240,
        follows_count: 315,
      });
    }
    if (url.pathname === "/facebook-graph/v26.0/17841427246422536")
      return json({ id: "17841427246422536", username: state.username });
    if (
      url.pathname === "/graph/v24.0/5678/media" ||
      url.pathname === "/facebook-graph/v26.0/5678/media" ||
      url.pathname === "/facebook-graph/v26.0/17841427246422536/media"
    ) {
      if (
        url.pathname.startsWith("/graph/") &&
        req.headers.authorization !== "Bearer long-local-token"
      )
        return json({ error: { code: 190 } }, 401);
      if (state.delay) await new Promise((r) => setTimeout(r, state.delay));
      if (state.failure)
        return json(
          {
            error: {
              code: state.failure === 401 ? 190 : 2,
              message: "Never expose provider diagnostics",
            },
          },
          state.failure,
        );
      if (url.searchParams.get("fields")?.includes("like_count")) {
        if (state.postStatsFailure) return json({ error: { code: 2 } }, 503);
        return json({
          data: state.media.map((post) => ({
            id: post.id,
            like_count: post.like_count,
            comments_count: post.comments_count,
          })),
        });
      }
      return json({ data: state.media });
    }
    if (url.pathname === "/image") {
      const bytes = state.imageBroken
        ? Buffer.from("broken")
        : await sharp(
            await readFile(
              new URL(
                `../../public/images/photos/gallery-${(Number(new URL(url.searchParams.get("source")!).pathname.match(/\d+/)?.[0] ?? 0) % 4) + 1}.webp`,
                import.meta.url,
              ),
            ),
          )
            .resize(state.imageSize[0], state.imageSize[1], { fit: "cover" })
            .png()
            .toBuffer();
      res.writeHead(200, { "Content-Type": state.imageType });
      return res.end(bytes);
    }
    return json({ error: "unexpected endpoint" }, 404);
  });
  return {
    state,
    start: () =>
      new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      }),
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}
export function defaultMedia() {
  return Array.from({ length: 14 }, (_, i) => ({
    id: String(100 + i),
    like_count: i === 1 ? 0 : 42 + i,
    comments_count: i === 1 ? 0 : 7 + i,
    media_type: i === 0 ? "VIDEO" : i === 1 ? "CAROUSEL_ALBUM" : "IMAGE",
    media_url: `https://scontent.cdninstagram.com/${i}.jpg`,
    thumbnail_url: `https://scontent.cdninstagram.com/${i}-thumb.jpg`,
    caption: `Ukázkový příspěvek ${i + 1} — pouze místní test`,
    permalink: `https://www.instagram.com/${i === 0 ? "reel" : "p"}/TEST_${i}/`,
    timestamp: new Date(Date.UTC(2026, 9, 20, 12 - i)).toISOString(),
  }));
}
