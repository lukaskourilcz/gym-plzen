import assert from "node:assert/strict";
import test, { beforeEach, afterEach, mock } from "node:test";
import { createComgateClient } from "../../src/lib/integrations/comgate";
import {
  httpRequest,
  HttpError,
  type RequestOptions,
} from "../../src/lib/helpers/http";
import { logger } from "../../src/lib/helpers/logger";

beforeEach(() => {
  mock.method(logger, "error", () => {});
});
afterEach(() => mock.restoreAll());

const config = {
  merchantId: "merchant-test",
  secret: "test-secret",
  testMode: true,
};
const params = {
  orderNumber: "9c08396c-e805-4a15-8d3e-58a1b00a5682",
  amountMinor: 28900,
  payer: {
    email: "tester@example.test",
    firstName: "Jan",
    lastName: "Novák",
    phone: "+420777123456",
  },
  description: "Rezervace NAVI",
  returnUrl: "https://www.example.test/return?token=private-token",
};
const response = {
  code: 0,
  message: "OK",
  transId: "AB12-CD34-EF56",
  redirect:
    "https://pay3.comgate.cz/client/instructions/index?id=AB12-CD34-EF56",
};
const status = {
  code: 0,
  message: "OK",
  transId: response.transId,
  refId: params.orderNumber,
  test: "true",
  price: "28900",
  curr: "CZK",
  status: "PAID",
  email: "tester@example.test",
  secret: "must-never-be-returned",
};
function stub(value: unknown): typeof httpRequest {
  return async <T>() => value as T;
}

test("Comgate create uses REST2 Basic auth, explicit test mode, protected return URL and 30-minute expiry", async () => {
  const request: typeof httpRequest = async <T>(
    url: string,
    options: RequestOptions = {},
  ) => {
    assert.equal(url, "https://payments.comgate.cz/v2.0/payment.json");
    assert.equal(options.method, "POST");
    assert.equal(options.retries, 0);
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(
      new Headers(options.headers).get("authorization"),
      `Basic ${Buffer.from("merchant-test:test-secret").toString("base64")}`,
    );
    const body = options.json as Record<string, unknown>;
    assert.equal(body.test, true);
    assert.equal(body.price, 28900);
    assert.equal(body.curr, "CZK");
    assert.equal(body.refId, params.orderNumber);
    assert.equal(body.fullName, "Jan Novák");
    assert.equal(body.expirationTime, "30m");
    assert.equal(body.dynamicExpiration, false);
    for (const key of ["url_paid", "url_pending", "url_cancelled"])
      assert.equal(body[key], params.returnUrl);
    assert.equal(body.secret, undefined);
    assert.equal(body.notificationUrl, undefined);
    return response as T;
  };
  assert.deepEqual(
    await createComgateClient(config, request).createPayment(params),
    {
      created: true,
      payment: { id: response.transId, gwUrl: response.redirect },
    },
  );
});

test("Comgate status normalizes API values and strips secrets and customer data", async () => {
  const result = await createComgateClient(config, stub(status)).getPayment(
    response.transId,
  );
  assert.deepEqual(result, {
    found: true,
    payment: {
      id: response.transId,
      orderNumber: params.orderNumber,
      amountMinor: 28900,
      currency: "CZK",
      state: "PAID",
      testMode: true,
      merchantId: config.merchantId,
    },
  });
});

test("Comgate rejects wrong transaction, environment, merchant and malformed authoritative status", async () => {
  for (const change of [
    { transId: "OTHER" },
    { test: "false" },
    { test: "invalid" },
    { merchant: "other-shop" },
    { price: "28900xyz" },
    { price: "9007199254740993" },
    { status: "UNRECOGNIZED" },
    { code: 1200 },
  ]) {
    const result = await createComgateClient(
      config,
      stub({ ...status, ...change }),
    ).getPayment(response.transId);
    assert.equal(result.found, false);
  }
});

test("Comgate cannot create below provider minimum or with missing payer name, HTTP return URL or absent keys", async () => {
  let calls = 0;
  const request: typeof httpRequest = async <T>() => {
    calls++;
    return response as T;
  };
  const client = createComgateClient(config, request);
  for (const change of [
    { amountMinor: 99 },
    { amountMinor: 100_000_001 },
    { amountMinor: 28900.1 },
    { returnUrl: "http://example.test/return" },
    { payer: { email: "tester@example.test" } },
  ]) {
    assert.deepEqual(await client.createPayment({ ...params, ...change }), {
      created: false,
      error: "comgate_invalid_input",
      ambiguous: false,
    });
  }
  assert.deepEqual(
    await createComgateClient({ ...config, secret: "" }, request).createPayment(
      params,
    ),
    { created: false, error: "comgate_not_configured", ambiguous: false },
  );
  assert.equal(calls, 0);
});

test("Comgate rejects lookalike/foreign gateway URLs and treats malformed successful creation as ambiguous", async () => {
  for (const redirect of [
    "https://payments.comgate.cz.evil.test/pay",
    "https://evilcomgate.cz/pay",
    "http://payments.comgate.cz/pay",
    "https://user:password@payments.comgate.cz/pay",
    "https://pay7.comgate.cz/pay",
  ]) {
    const result = await createComgateClient(
      config,
      stub({ ...response, redirect }),
    ).createPayment(params);
    assert.equal(result.created, false);
    if (!result.created) assert.equal(result.ambiguous, true);
  }
  const result = await createComgateClient(
    config,
    stub({ code: 0 }),
  ).createPayment(params);
  assert.equal(result.created, false);
  if (!result.created) assert.equal(result.ambiguous, true);
});

test("Comgate creation timeout makes exactly one HTTP attempt and remains ambiguous", async (t) => {
  let calls = 0;
  t.mock.method(globalThis, "fetch", async () => {
    calls++;
    throw new TypeError("network failed with sensitive provider data");
  });
  const result = await createComgateClient(config).createPayment(params);
  assert.deepEqual(result, {
    created: false,
    error: "comgate_request_failed",
    ambiguous: true,
  });
  assert.equal(calls, 1);
});

test("Comgate distinguishes definite input rejection from uncertain server failures", async () => {
  for (const [code, ambiguous] of [
    [1309, false],
    [1200, true],
    [1100, true],
  ] as const) {
    const result = await createComgateClient(
      config,
      stub({ code }),
    ).createPayment(params);
    assert.deepEqual(result, {
      created: false,
      error: `comgate_code_${code}`,
      ambiguous,
    });
  }
  for (const [httpStatus, ambiguous] of [
    [400, false],
    [401, false],
    [500, true],
  ] as const) {
    const request: typeof httpRequest = async () => {
      throw new HttpError("sensitive body", httpStatus, {
        secret: config.secret,
      });
    };
    assert.deepEqual(
      await createComgateClient(config, request).createPayment(params),
      { created: false, error: `comgate_http_${httpStatus}`, ambiguous },
    );
  }
});

test("Comgate webhook authentication validates secret, merchant, environment and required values without trusting status", () => {
  const client = createComgateClient(config);
  const notification = {
    ...status,
    merchant: config.merchantId,
    secret: config.secret,
  };
  assert.equal(client.verifyNotification(notification), true);
  assert.equal(
    client.verifyNotification(
      new URLSearchParams(
        Object.entries(notification).map(([key, value]) => [
          key,
          String(value),
        ]),
      ),
    ),
    true,
  );
  for (const change of [
    { secret: "wrong" },
    { merchant: "wrong" },
    { test: "false" },
    { price: "NaN" },
    { transId: "../other" },
    { curr: "CZKK" },
  ]) {
    assert.equal(
      client.verifyNotification({ ...notification, ...change }),
      false,
    );
  }
  const duplicate = new URLSearchParams(
    Object.entries(notification).map(([key, value]) => [key, String(value)]),
  );
  duplicate.append("secret", config.secret);
  assert.equal(client.verifyNotification(duplicate), false);
});
