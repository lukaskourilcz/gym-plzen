import assert from "node:assert/strict";
import test from "node:test";
import {
  authStorageKey,
  canonicalOAuthOrigin,
  codeVerifierCookie,
  parseOAuthProvider,
  requestHost,
} from "../../src/lib/auth/oauth";

const PROVIDERS = [{ id: "google" as const }, { id: "apple" as const }];
const CANONICAL = "https://www.navigym.cz";

test("only a provider this deployment offers can start a flow", () => {
  assert.equal(parseOAuthProvider("google", PROVIDERS), "google");
  assert.equal(parseOAuthProvider(" Google ", PROVIDERS), "google");
  // Configured elsewhere but switched off here.
  assert.equal(parseOAuthProvider("azure", PROVIDERS), null);
  assert.equal(parseOAuthProvider("", PROVIDERS), null);
  assert.equal(parseOAuthProvider(null, PROVIDERS), null);
  assert.equal(parseOAuthProvider("https://evil.example", PROVIDERS), null);
});

test("the cookie-owning host comes from the forwarded headers", () => {
  const headers = (init: Record<string, string>) => new Headers(init);
  assert.equal(
    requestHost(headers({ host: "www.navigym.cz" })),
    "www.navigym.cz",
  );
  // Vercel forwards the public host; `host` is then the internal one.
  assert.equal(
    requestHost(
      headers({
        host: "internal.vercel",
        "x-forwarded-host": "www.navigym.cz",
      }),
    ),
    "www.navigym.cz",
  );
  assert.equal(
    requestHost(
      headers({ "x-forwarded-host": "www.navigym.cz, proxy.internal" }),
    ),
    "www.navigym.cz",
  );
  assert.equal(
    requestHost(headers({ host: "WWW.NaviGym.CZ" })),
    "www.navigym.cz",
  );
  assert.equal(requestHost(headers({})), null);
});

test("an OAuth flow is moved to the canonical host before it starts", () => {
  // The pre-rebrand domain still answers, and it is the one a returning
  // visitor has bookmarked. Starting there writes the PKCE verifier on a host
  // the callback never returns to, which is issue #18.
  assert.equal(
    canonicalOAuthOrigin("www.namastegym.cz", CANONICAL, "production"),
    CANONICAL,
  );
  assert.equal(
    canonicalOAuthOrigin("navigym.cz", CANONICAL, "production"),
    CANONICAL,
  );
});

test("the canonical move cannot loop", () => {
  // Already there: the second pass must decline, or the visitor bounces for
  // ever between /auth/signin and itself.
  assert.equal(
    canonicalOAuthOrigin("www.navigym.cz", CANONICAL, "production"),
    null,
  );
  assert.equal(
    canonicalOAuthOrigin("WWW.NAVIGYM.CZ", CANONICAL, "production"),
    null,
  );
  // No host to compare, or an unusable canonical origin: stay put rather than
  // redirect blindly.
  assert.equal(canonicalOAuthOrigin(null, CANONICAL, "production"), null);
  assert.equal(canonicalOAuthOrigin("www.navigym.cz", "not a url"), null);
});

test("preview deployments keep their own origin", () => {
  // Their canonical origin is production; sending a preview login there would
  // sign the visitor in on the wrong deployment.
  assert.equal(
    canonicalOAuthOrigin("gym-plzen-abc123.vercel.app", CANONICAL, "preview"),
    null,
  );
});

test("the verifier cookie name matches the one supabase-js writes", () => {
  const url = "https://rkmunagymohxtclymacm.supabase.co";
  assert.equal(authStorageKey(url), "sb-rkmunagymohxtclymacm-auth-token");
  assert.equal(
    codeVerifierCookie(url),
    "sb-rkmunagymohxtclymacm-auth-token-code-verifier",
  );
});

test("an unset or malformed Supabase URL yields no cookie name", () => {
  assert.equal(authStorageKey(undefined), null);
  assert.equal(authStorageKey("not a url"), null);
  assert.equal(codeVerifierCookie("not a url"), null);
});
