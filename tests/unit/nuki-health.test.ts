import assert from "node:assert/strict";
import test from "node:test";
import { createNukiHealthClient } from "../../src/lib/integrations/nuki-health";
import {
  describeNukiDiagnosis,
  parseNukiDiagnosis,
} from "../../src/lib/helpers/nuki-diagnostics";
import {
  HttpError,
  type httpRequest,
  type RequestOptions,
} from "../../src/lib/helpers/http";

const healthy = {
  components: ["Nuki Web", "Nuki REST API", "Nuki Remote Access"].map(
    (name) => ({ name, status: "operational" }),
  ),
};
async function probe(device: unknown, summary: unknown = healthy) {
  const request: typeof httpRequest = async <T>(
    url: string,
    opts: RequestOptions = {},
  ) => {
    assert.equal(opts.method, undefined);
    assert.equal(opts.retries, 0);
    assert.equal(opts.cache, "no-store");
    assert.equal(opts.timeoutMs, 5000);
    const value = url.startsWith("https://api.nuki.io/") ? device : summary;
    if (url.startsWith("https://status.nuki.io/"))
      assert.equal(opts.headers, undefined);
    if (value instanceof Error) throw value;
    return value as T;
  };
  return createNukiHealthClient(
    { token: "private-token", lockId: "123" },
    request,
  ).check();
}

test("responsive cloud with disconnected lock is distinct from a cloud incident", async () => {
  const offline = await probe({ serverState: 4 });
  assert.equal(offline.code, "lock_offline");
  assert.equal(offline.lockState, "offline");
  const cloud = await probe(
    { serverState: 4 },
    {
      components: healthy.components.map((c) => ({
        ...c,
        status: c.name === "Nuki REST API" ? "degraded_performance" : c.status,
      })),
    },
  );
  assert.equal(cloud.code, "service_incident");
  assert.equal(cloud.lockState, "offline");
  assert.deepEqual(cloud.affectedServices, ["Nuki REST API"]);
  assert.match(
    describeNukiDiagnosis(cloud).body,
    /Dopad na konkrétní zámek nelze určit/,
  );
});

test("API HTTP failures identify service, permission and quota problems without blaming the lock", async () => {
  for (const [status, code] of [
    [503, "api_unavailable"],
    [502, "api_unavailable"],
    [401, "access_denied"],
    [403, "access_denied"],
    [404, "access_denied"],
    [429, "rate_limited"],
    [400, "state_unknown"],
  ] as const) {
    const result = await probe(
      new HttpError("Bearer private-token", status, { code: "123456" }),
    );
    assert.equal(result.code, code);
    assert.equal(result.lockState, "unknown");
    assert.equal(result.apiHttpStatus, status);
    assert.ok(!JSON.stringify(result).includes("private-token"));
    assert.ok(!JSON.stringify(result).includes("123456"));
  }
});

test("timeouts do not establish a cloud outage; malformed or undocumented lock states stay unknown", async () => {
  assert.equal((await probe(new Error("timeout"))).code, "connection_unknown");
  for (const device of [
    null,
    "broken",
    {},
    { serverState: "0" },
    { serverState: 123 },
    { serverState: 1 },
  ]) {
    const result = await probe(device);
    assert.equal(result.code, "state_unknown");
    assert.equal(result.lockState, "unknown");
  }
});

test("status failures and unrelated incidents never turn a responding online lock into an outage", async () => {
  for (const summary of [
    new Error("timeout"),
    null,
    {},
    { components: [] },
    { components: [{ name: "Nuki Web", status: "operational" }] },
    { components: [{ name: "Nuki Web", status: "unexpected" }] },
  ]) {
    const result = await probe({ serverState: 0 }, summary);
    assert.equal(result.code, "online");
    assert.equal(result.serviceStatus, "unknown");
  }
  const result = await probe(
    { serverState: 0 },
    {
      components: [
        ...healthy.components,
        { name: "Airbnb", status: "major_outage" },
      ],
    },
  );
  assert.equal(result.code, "online");
  assert.equal(result.serviceStatus, "operational");
});

test("a relevant public incident is recorded even with an online lock, without claiming failed codes", async () => {
  const result = await probe(
    { serverState: 0 },
    {
      components: healthy.components.map((c) => ({
        ...c,
        status: "partial_outage",
      })),
    },
  );
  assert.equal(result.code, "service_incident");
  assert.equal(result.lockState, "online");
  assert.match(describeNukiDiagnosis(result).body, /Zámek: připojený/);
  assert.equal(
    parseNukiDiagnosis({ nukiDiagnosis: result })?.code,
    "service_incident",
  );
  assert.equal(
    parseNukiDiagnosis({ nukiDiagnosis: { ...result, code: "untrusted" } }),
    null,
  );
});

test("admin presentation retains the diagnosis, evidence and action without truncating the notification body", async () => {
  const { incidentPresentation } =
    await import("../../src/lib/helpers/incident-presentation");
  const diagnosis = await probe(new HttpError("request failed", 503, null));
  const view = incidentPresentation({
    title: "old title",
    body: "old body",
    context: { nukiDiagnosis: diagnosis },
  });
  assert.equal(view.title, "Nuki Web/API vrací chybu služby");
  assert.match(view.cause!, /HTTP 503/);
  assert.match(view.action!, /https:\/\/status.nuki.io/);
  assert.match(view.impact!, /Již ověřené kódy/);
});
