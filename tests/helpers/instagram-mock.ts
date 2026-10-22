import { createServer } from "node:http";
import sharp from "sharp";

/** Fictional read-only provider, bound to loopback. Never imports application credentials. */
export function createInstagramMock(port: number) {
  const state = {
    username: "navi_plzen",
    failure: 0,
    imageType: "image/png",
    imageBroken: false,
    flatToken: false,
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
        account_type: "BUSINESS",
      });
    if (url.pathname === "/graph/v24.0/5678/media") {
      if (req.headers.authorization !== "Bearer long-local-token")
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
      return json({ data: state.media });
    }
    if (url.pathname === "/image") {
      const bytes = state.imageBroken
        ? Buffer.from("broken")
        : await sharp({
            create: {
              width: 480,
              height: 480,
              channels: 3,
              background: "#0e4937",
            },
          })
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
    media_type: i === 0 ? "VIDEO" : i === 1 ? "CAROUSEL_ALBUM" : "IMAGE",
    media_url: `https://scontent.cdninstagram.com/${i}.jpg`,
    thumbnail_url: `https://scontent.cdninstagram.com/${i}-thumb.jpg`,
    caption: `Ukázkový příspěvek ${i + 1} — pouze místní test`,
    permalink: `https://www.instagram.com/${i === 0 ? "reel" : "p"}/TEST_${i}/`,
    timestamp: new Date(Date.UTC(2026, 9, 20, 12 - i)).toISOString(),
  }));
}
