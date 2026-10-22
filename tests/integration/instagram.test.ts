import { INSTAGRAM_PORT } from "./setup";
import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  databaseReady,
  rows,
  resetDatabase,
  setSetting,
  seedProfile,
  startProviders,
  stopEverything,
  resend,
  comgate,
} from "./setup";
import { createInstagramMock, defaultMedia } from "../helpers/instagram-mock";
import {
  connectInstagram,
  syncInstagram,
  loadInstagramFeed,
  getInstagramAdminState,
  disconnectInstagram,
  setInstagramHidden,
  instagramImageSource,
} from "../../src/lib/services/instagram";
import { readInstagramImage } from "../../src/lib/integrations/instagram-image";
import {
  instagramAuthorizationUrl,
  readLimitedBody,
  parseInstagramJson,
} from "../../src/lib/integrations/instagram";
import {
  createInstagramState,
  verifyInstagramState,
  encryptInstagramToken,
  decryptInstagramToken,
  verifyInstagramSignedRequest,
  instagramDeletionReceipt,
  verifyInstagramDeletionReceipt,
} from "../../src/lib/helpers/instagram-vault";
import {
  isInstagramImageUrl,
  isInstagramPermalink,
  INSTAGRAM_ENABLED_KEY,
} from "../../src/lib/config/instagram";
import { BOOKING_TABLES } from "../helpers/booking-tables";
const mock = createInstagramMock(INSTAGRAM_PORT);
const dbTest = (name: string, fn: () => Promise<void>) =>
  test(name, { skip: !databaseReady }, fn);
before(async () => {
  if (databaseReady) {
    await startProviders();
    await mock.start();
  }
});
after(async () => {
  if (databaseReady) {
    await mock.stop();
    await stopEverything();
  }
});
beforeEach(async () => {
  if (!databaseReady) return;
  await resetDatabase();
  await rows("delete from instagram_connection");
  await setSetting(INSTAGRAM_ENABLED_KEY, true);
  Object.assign(mock.state, {
    username: "navi_plzen",
    accountType: "Business",
    failure: 0,
    imageType: "image/png",
    imageBroken: false,
    flatToken: false,
    media: defaultMedia(),
    delay: 0,
  });
  mock.state.calls.length = 0;
});
const connect = () =>
  connectInstagram(
    "local-test-code",
    "http://localhost/callback",
    "local-admin",
  );
const allowSync = () =>
  rows("update instagram_connection set last_attempt_at=null");
async function snapshot() {
  return Promise.all(
    BOOKING_TABLES.map((t) =>
      rows(
        `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb) as data from ${t} t`,
      ),
    ),
  );
}

dbTest(
  "Instagram connection, sync, visibility and deletion never change reservations, codes, payments or messages",
  async () => {
    const id = randomUUID();
    await seedProfile({
      id,
      email: "untouched@example.test",
      fullName: "Stávající zákazník",
    });
    const r = randomUUID();
    await rows(
      "insert into reservation(id,user_id,starts_at,ends_at,status,price_cents,contact_email) values($1,$2,now()+interval '2 days',now()+interval '2 days 75 minutes','confirmed',19900,'untouched@example.test')",
      [r, id],
    );
    await rows(
      "insert into access_code(reservation_id,code_hash,code_last2,valid_from,valid_until,status) values($1,'synthetic-hash','42',now()+interval '2 days',now()+interval '2 days 75 minutes','active')",
      [r],
    );
    const before = await snapshot();
    await connect();
    assert.equal((await syncInstagram({ force: true })).synced, true);
    const feed = await loadInstagramFeed();
    assert.equal(feed.posts.length, 12);
    assert.equal(feed.posts[0]!.kind, "VIDEO");
    const serialized = JSON.stringify([feed, await getInstagramAdminState()]);
    assert.doesNotMatch(
      serialized,
      /long-local-token|tokenCiphertext|imageUrl|cdninstagram/,
    );
    const [secret] = await rows<{ token_ciphertext: string }>(
      "select token_ciphertext from instagram_connection",
    );
    assert.ok(secret!.token_ciphertext.startsWith("v1."));
    assert.ok(!secret!.token_ciphertext.includes("long-local-token"));
    await setInstagramHidden("100", true);
    assert.ok(!(await loadInstagramFeed()).posts.some((p) => p.id === "100"));
    assert.equal(await instagramImageSource("100"), null);
    await allowSync();
    await syncInstagram({ force: true });
    assert.ok(
      (await getInstagramAdminState()).posts.find((p) => p.id === "100")!
        .hidden,
    );
    await disconnectInstagram();
    assert.equal((await rows("select * from instagram_media")).length, 0);
    assert.equal((await loadInstagramFeed()).posts.length, 0);
    assert.deepEqual(await snapshot(), before);
    assert.equal(resend.sent.length, 0);
    assert.equal(comgate.creates.length, 0);
  },
);
dbTest(
  "provider outage preserves last valid posts but authorization loss and 24h expiry hide them",
  async () => {
    await connect();
    await syncInstagram();
    await allowSync();
    mock.state.failure = 503;
    assert.equal((await syncInstagram({ force: true })).problem, "provider");
    assert.equal((await loadInstagramFeed()).posts.length, 12);
    await rows(
      "update instagram_connection set last_synced_at=now()-interval '25 hours'",
    );
    assert.equal((await loadInstagramFeed()).posts.length, 0);
    await rows("update instagram_connection set last_synced_at=now()");
    await allowSync();
    mock.state.failure = 401;
    assert.equal(
      (await syncInstagram({ force: true })).problem,
      "authorization",
    );
    assert.equal((await loadInstagramFeed()).posts.length, 0);
    assert.equal(await instagramImageSource("101"), null);
  },
);
dbTest(
  "refreshes expiring token, serializes repeated sync and preserves hidden preferences",
  async () => {
    await connect();
    await rows(
      "update instagram_connection set expires_at=now()+interval '2 days', token_refreshed_at=now()-interval '2 days'",
    );
    const results = await Promise.all([
      syncInstagram({ force: true }),
      syncInstagram({ force: true }),
    ]);
    assert.equal(results.filter((r) => r.synced).length, 1);
    assert.ok(
      mock.state.calls.some((c) => c.path.endsWith("refresh_access_token")),
    );
    await setInstagramHidden("100", true);
    mock.state.media = [];
    await allowSync();
    await syncInstagram({ force: true });
    const retained = await rows<{ hidden: boolean; image_url: string }>(
      "select hidden,image_url from instagram_media",
    );
    assert.equal(retained.length, 1);
    assert.equal(retained[0]!.image_url, "");
    mock.state.media = defaultMedia();
    await allowSync();
    await syncInstagram({ force: true });
    assert.equal(
      (await getInstagramAdminState()).posts.find((p) => p.id === "100")!
        .hidden,
      true,
    );
  },
);
dbTest(
  "disconnect fences late provider response and stale signed callback cannot remove a new grant",
  async () => {
    await connect();
    mock.state.delay = 180;
    const pending = syncInstagram({ force: true });
    for (
      let i = 0;
      i < 50 && !mock.state.calls.some((c) => c.path.endsWith("/media"));
      i++
    )
      await new Promise((r) => setTimeout(r, 10));
    await disconnectInstagram();
    await pending;
    assert.equal((await rows("select * from instagram_media")).length, 0);
    mock.state.delay = 0;
    await connect();
    await disconnectInstagram({
      userId: "1234",
      issuedAt: new Date(Date.now() - 60_000),
    });
    assert.equal((await getInstagramAdminState()).connected, true);
    await disconnectInstagram({ userId: "9999", issuedAt: new Date() });
    assert.equal((await getInstagramAdminState()).connected, true);
    await disconnectInstagram({ userId: "1234", issuedAt: new Date() });
    assert.equal((await getInstagramAdminState()).connected, false);
  },
);
dbTest(
  "wrong account and malformed provider data cannot replace an existing feed",
  async () => {
    mock.state.flatToken = true;
    await connect();
    await syncInstagram();
    mock.state.accountType = "PERSONAL";
    await assert.rejects(connect, /wrong_account/);
    mock.state.accountType = "Business";
    mock.state.username = "wrong_account";
    await assert.rejects(connect, /wrong_account/);
    assert.equal((await getInstagramAdminState()).username, "navi_plzen");
    await allowSync();
    mock.state.media[0]!.thumbnail_url = "http://127.0.0.1/private";
    assert.equal((await syncInstagram({ force: true })).problem, "provider");
    assert.equal((await loadInstagramFeed()).posts.length, 12);
    await setSetting(INSTAGRAM_ENABLED_KEY, false);
    assert.equal((await loadInstagramFeed()).enabled, false);
  },
);
dbTest(
  "bounded image proxy converts a thumbnail, rejects SVG, corrupt images and untrusted hosts",
  async () => {
    const data = await readInstagramImage(
      "https://scontent.cdninstagram.com/a.jpg",
    );
    const info = await sharp(Buffer.from(data, "base64")).metadata();
    assert.equal(info.format, "webp");
    assert.equal(info.width, 480);
    for (const bad of [
      "http://scontent.cdninstagram.com/a.jpg",
      "https://127.0.0.1/a",
      "https://cdninstagram.com.evil.test/a",
    ])
      await assert.rejects(() => readInstagramImage(bad));
    mock.state.imageType = "image/svg+xml";
    await assert.rejects(() =>
      readInstagramImage("https://scontent.cdninstagram.com/a.jpg"),
    );
    mock.state.imageType = "image/png";
    mock.state.imageBroken = true;
    await assert.rejects(() =>
      readInstagramImage("https://scontent.cdninstagram.com/a.jpg"),
    );
    await assert.rejects(() => readLimitedBody(new Response("123456"), 5));
  },
);
dbTest(
  "private Instagram tables deny anonymous and authenticated Supabase roles",
  async () => {
    for (const role of ["anon", "authenticated"])
      for (const table of ["instagram_connection", "instagram_media"]) {
        const [grants] = await rows<{ allowed: boolean }>(
          "select has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE') as allowed",
          [role, table],
        );
        assert.equal(grants!.allowed, false);
        const [rls] = await rows<{ enabled: boolean }>(
          "select relrowsecurity as enabled from pg_class where oid=$1::regclass",
          [table],
        );
        assert.equal(rls!.enabled, true);
      }
  },
);

test("OAuth binds state to the admin, nonce, purpose and ten-minute window; credentials are authenticated", () => {
  const state = createInstagramState("admin-a", 1000);
  assert.equal(
    verifyInstagramState(state.cookie, state.nonce, "admin-a", 601000),
    true,
  );
  for (const [cookie, nonce, admin, now] of [
    [state.cookie, state.nonce, "admin-b", 1000],
    [state.cookie, "wrong", "admin-a", 1000],
    [state.cookie, state.nonce, "admin-a", 601001],
    [state.cookie + "x", state.nonce, "admin-a", 1000],
    [state.cookie, state.nonce, "admin-a", 999],
  ] as const)
    assert.equal(verifyInstagramState(cookie, nonce, admin, now), false);
  const token = encryptInstagramToken("secret-token", "1234");
  assert.notEqual(token, encryptInstagramToken("secret-token", "1234"));
  assert.equal(decryptInstagramToken(token, "1234"), "secret-token");
  assert.throws(() => decryptInstagramToken(token, "5678"));
  assert.throws(() => decryptInstagramToken(token + "x", "1234"));
  const auth = new URL(
    instagramAuthorizationUrl("http://localhost/callback", state.nonce),
  );
  assert.equal(auth.searchParams.get("scope"), "instagram_business_basic");
  assert.equal(auth.searchParams.get("state"), state.nonce);
  const receipt = instagramDeletionReceipt();
  assert.equal(verifyInstagramDeletionReceipt(receipt), true);
  assert.equal(verifyInstagramDeletionReceipt(receipt + "x"), false);
});
test("signed Meta callbacks reject tampering and user-controlled fetch links", () => {
  const payload = Buffer.from(
    JSON.stringify({
      algorithm: "HMAC-SHA256",
      user_id: "1234",
      issued_at: Math.floor(Date.now() / 1000),
    }),
  ).toString("base64url");
  const mac = createHmac("sha256", "local-instagram-secret")
    .update(payload)
    .digest("base64url");
  assert.equal(
    verifyInstagramSignedRequest(`${mac}.${payload}`).userId,
    "1234",
  );
  assert.throws(() => verifyInstagramSignedRequest(`${mac}.${payload}x`));
  assert.equal(
    isInstagramPermalink("https://www.instagram.com/reel/ABC_1/"),
    true,
  );
  assert.equal(
    isInstagramPermalink("https://www.instagram.com/accounts/login/"),
    false,
  );
  assert.equal(isInstagramImageUrl("https://evilcdninstagram.com/x"), false);
});

test("64-bit Meta identifiers retain exact digits before account matching", () => {
  assert.deepEqual(
    parseInstagramJson(
      '{"user_id":17841400008460057,"id":17841400008460059,"expires_in":5184000}',
    ),
    {
      user_id: "17841400008460057",
      id: "17841400008460059",
      expires_in: 5184000,
    },
  );
});
