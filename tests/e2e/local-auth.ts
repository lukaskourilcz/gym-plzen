import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { requireTestDatabaseUrl } from "../helpers/test-database";

/** A loopback-only Auth protocol fixture; it never contacts hosted Supabase. */
export function createLocalAuth(port: number) {
  const sql = postgres(requireTestDatabaseUrl(), { prepare: false, max: 2 });
  type User = {
    id: string;
    email: string;
    password: string;
    user_metadata: Record<string, unknown>;
    created_at: string;
  };
  const users = new Map<string, User>();
  const sessions = new Map<string, string>();
  const refreshTokens = new Map<string, string>();
  const publicUser = (user: User) => ({
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata,
    created_at: user.created_at,
    aud: "authenticated",
    role: "authenticated",
    app_metadata: { provider: "email", providers: ["email"] },
    email_confirmed_at: user.created_at,
    updated_at: user.created_at,
    identities: [],
  });
  function session(user: User) {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const encode = (data: unknown) =>
      Buffer.from(JSON.stringify(data)).toString("base64url");
    const access_token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user.id, aud: "authenticated", role: "authenticated", exp })}.${randomUUID()}`;
    const refresh_token = randomUUID();
    sessions.set(access_token, user.id);
    refreshTokens.set(refresh_token, user.id);
    return {
      access_token,
      refresh_token,
      expires_in: 3600,
      expires_at: exp,
      token_type: "bearer",
      user: publicUser(user),
    };
  }
  async function body(request: IncomingMessage) {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString();
    return (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
  }
  const server = createServer(async (request, response) => {
    response.setHeader("content-type", "application/json");
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-headers", "*");
    response.setHeader("access-control-allow-methods", "GET,POST,PUT,OPTIONS");
    const reply = (status: number, value: unknown) => {
      response.writeHead(status).end(JSON.stringify(value));
    };
    if (request.method === "OPTIONS") return reply(200, {});
    try {
      const url = new URL(request.url ?? "/", "http://127.0.0.1");
      const token = request.headers.authorization?.replace(/^Bearer /i, "");
      if (url.pathname.startsWith("/auth/v1/admin/users")) {
        if (token !== "local-admin-key") return reply(403, {});
        if (request.method === "GET")
          return reply(200, { users: [...users.values()].map(publicUser) });
        const input = await body(request);
        if (request.method === "PUT") {
          const user = users.get(url.pathname.split("/").at(-1)!);
          if (!user) return reply(404, {});
          user.password = String(input.password);
          return reply(200, publicUser(user));
        }
        const email = String(input.email);
        if ([...users.values()].some((user) => user.email === email))
          return reply(422, {
            code: "email_exists",
            msg: "Already registered",
          });
        const user: User = {
          id: randomUUID(),
          email,
          password: String(input.password),
          user_metadata: (input.user_metadata ?? {}) as Record<string, unknown>,
          created_at: new Date().toISOString(),
        };
        users.set(user.id, user);
        return reply(200, publicUser(user));
      }
      if (url.pathname === "/auth/v1/token" && request.method === "POST") {
        const input = await body(request);
        const user =
          url.searchParams.get("grant_type") === "refresh_token"
            ? users.get(refreshTokens.get(String(input.refresh_token)) ?? "")
            : [...users.values()].find(
                (u) => u.email === input.email && u.password === input.password,
              );
        return user
          ? reply(200, session(user))
          : reply(400, {
              code: "invalid_credentials",
              msg: "Invalid credentials",
            });
      }
      if (url.pathname === "/auth/v1/user") {
        const user = users.get(sessions.get(token ?? "") ?? "");
        if (!user) return reply(401, { msg: "Invalid session" });
        if (request.method === "PUT") {
          const input = await body(request);
          if (input.password) user.password = String(input.password);
        }
        return reply(200, publicUser(user));
      }
      if (url.pathname === "/auth/v1/logout") {
        sessions.delete(token ?? "");
        return reply(204, null);
      }
      if (url.pathname === "/auth/v1/recover") return reply(200, {});
      if (url.pathname === "/rest/v1/profiles" && request.method === "POST") {
        if (token !== "local-admin-key") return reply(403, {});
        const input = await body(request);
        await sql`insert into profiles (id, email, full_name, role)
          values (${String(input.id)}, ${String(input.email)}, ${String(input.full_name)}, ${String(input.role)})
          on conflict (id) do update set email = excluded.email, full_name = excluded.full_name, role = excluded.role`;
        return reply(200, []);
      }
      return reply(404, { msg: "Unsupported local Auth fixture request" });
    } catch {
      return reply(500, { msg: "Local Auth fixture failed" });
    }
  });
  return {
    start: () =>
      new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      }),
    stop: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await sql.end({ timeout: 2 });
    },
  };
}
