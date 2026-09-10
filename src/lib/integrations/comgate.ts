import { z } from "zod";
import { env, hasEnv, requireEnv } from "@/lib/env";
import { httpRequest, HttpError } from "@/lib/helpers/http";
import { safeEqual } from "@/lib/helpers/crypto";
import { logger } from "@/lib/helpers/logger";

/** Comgate REST API 2.0: https://apidoc.comgate.cz/api/rest/ */
const API = "https://payments.comgate.cz/v2.0";
const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const amountSchema = z.union([
  z.number().int().nonnegative().safe(),
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().nonnegative().safe()),
]);
const testModeSchema = z.union([
  z.boolean(),
  z.enum(["true", "false"]).transform((value) => value === "true"),
]);
const statusSchema = z.object({
  code: z.literal(0),
  transId: idSchema,
  refId: z.string().min(1).max(128),
  status: z.enum(["PENDING", "PAID", "CANCELLED", "AUTHORIZED"]),
  price: amountSchema,
  curr: z.string().regex(/^[A-Z]{3}$/),
  test: testModeSchema,
  merchant: z.string().optional(),
});

export interface ComgatePayment {
  id: string;
  orderNumber: string;
  state: z.infer<typeof statusSchema>["status"];
  amountMinor: number;
  currency: string;
  testMode: boolean;
  /** Credential context; Comgate does not always echo merchant in /status. */
  merchantId: string;
  gwUrl?: string;
}

export interface CreateComgatePaymentParams {
  orderNumber: string;
  /** Integer haléře, e.g. 28900 for 289 Kč. */
  amountMinor: number;
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
  };
  description: string;
  /** Private return URL; used for PAID, CANCELLED and PENDING browser returns. */
  returnUrl: string;
}
export type CreateComgatePaymentResult =
  | { created: true; payment: { id: string; gwUrl: string } }
  | { created: false; error: string; ambiguous: boolean };
export type GetComgatePaymentResult =
  { found: true; payment: ComgatePayment } | { found: false; error: string };

interface ComgateConfig {
  merchantId: string;
  secret: string;
  testMode: boolean;
}

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !!url.hostname &&
      !url.username &&
      !url.password &&
      !url.hash
    );
  } catch {
    return false;
  }
}

function gatewayUrl(value: string): string {
  const url = new URL(value);
  if (
    !isHttpsUrl(value) ||
    url.port ||
    !/^(?:payments|pay[1-6])\.comgate\.cz$/.test(url.hostname)
  )
    throw new Error("comgate_invalid_gateway_url");
  // Preserve the exact provider URL. It may route to a specific payN host.
  return value;
}

const createSchema = z.object({
  orderNumber: idSchema,
  amountMinor: z.number().int().min(100).max(100_000_000),
  payer: z
    .object({
      email: z.string().email().max(254),
      firstName: z.string().max(60).optional(),
      lastName: z.string().max(60).optional(),
      phone: z.string().max(40).optional(),
    })
    .refine(
      (payer) =>
        !![payer.firstName, payer.lastName].filter(Boolean).join(" ").trim(),
    ),
  description: z.string().min(1).max(256),
  returnUrl: z.string().refine(isHttpsUrl),
});

const notificationSchema = statusSchema.omit({ code: true }).extend({
  merchant: z.string().min(1),
  secret: z.string().min(1).max(512),
});

/** Factory keeps HTTP contract tests independent from configured credentials. */
export function createComgateClient(
  config: ComgateConfig,
  request: typeof httpRequest = httpRequest,
) {
  const configured = !!config.merchantId.trim() && !!config.secret.trim();
  const headers = {
    authorization: `Basic ${Buffer.from(`${config.merchantId}:${config.secret}`).toString("base64")}`,
    accept: "application/json",
  };
  function failure(operation: string, error: unknown): string {
    // Provider messages/bodies can contain PII or secrets. Log only fixed codes.
    const reason =
      error instanceof HttpError
        ? `comgate_http_${error.status}`
        : "comgate_request_failed";
    logger.error(reason, { where: `comgate.${operation}` });
    return reason;
  }

  return {
    async createPayment(
      params: CreateComgatePaymentParams,
    ): Promise<CreateComgatePaymentResult> {
      if (!configured)
        return {
          created: false,
          error: "comgate_not_configured",
          ambiguous: false,
        };
      if (!createSchema.safeParse(params).success)
        return {
          created: false,
          error: "comgate_invalid_input",
          ambiguous: false,
        };
      try {
        const response = await request(`${API}/payment.json`, {
          method: "POST",
          headers,
          json: {
            test: config.testMode,
            country: "CZ",
            price: params.amountMinor,
            curr: "CZK",
            label: "NAVI Private Gym",
            refId: params.orderNumber,
            method: "ALL",
            email: params.payer.email,
            phone: params.payer.phone,
            fullName: [params.payer.firstName, params.payer.lastName]
              .filter(Boolean)
              .join(" "),
            name: params.description,
            category: "OTHER",
            delivery: "ELECTRONIC_DELIVERY",
            lang: "cs",
            expirationTime: "30m",
            dynamicExpiration: false,
            url_paid: params.returnUrl,
            url_cancelled: params.returnUrl,
            url_pending: params.returnUrl,
          },
          // refId is explicitly non-unique. Never retry an uncertain creation.
          retries: 0,
          redirect: "error",
          cache: "no-store",
        });
        const envelope = z.object({ code: z.number().int() }).parse(response);
        if (envelope.code !== 0) {
          // Only documented input/config errors prove creation was rejected.
          const rejected = [
            1102, 1103, 1107, 1301, 1303, 1304, 1305, 1306, 1308, 1309, 1310,
            1311, 1316, 1317, 1400,
          ].includes(envelope.code);
          logger.error(`comgate_code_${envelope.code}`, {
            where: "comgate.createPayment",
          });
          return {
            created: false,
            error: `comgate_code_${envelope.code}`,
            ambiguous: !rejected,
          };
        }
        const payment = z
          .object({ transId: idSchema, redirect: z.string().url() })
          .parse(response);
        return {
          created: true,
          payment: { id: payment.transId, gwUrl: gatewayUrl(payment.redirect) },
        };
      } catch (error) {
        const rejected =
          error instanceof HttpError &&
          [400, 401, 403, 404, 405, 422, 429].includes(error.status);
        return {
          created: false,
          error: failure("createPayment", error),
          ambiguous: !rejected,
        };
      }
    },
    async getPayment(id: string): Promise<GetComgatePaymentResult> {
      if (!configured) return { found: false, error: "comgate_not_configured" };
      if (!idSchema.safeParse(id).success)
        return { found: false, error: "comgate_invalid_payment_id" };
      try {
        const response = await request(
          `${API}/payment/transId/${encodeURIComponent(id)}.json`,
          {
            method: "GET",
            headers,
            retries: 1,
            redirect: "error",
            cache: "no-store",
          },
        );
        const payment = statusSchema.parse(response);
        if (
          payment.transId !== id ||
          payment.test !== config.testMode ||
          (payment.merchant !== undefined &&
            payment.merchant !== config.merchantId)
        ) {
          throw new Error("comgate_payment_mismatch");
        }
        return {
          found: true,
          payment: {
            id: payment.transId,
            orderNumber: payment.refId,
            state: payment.status,
            amountMinor: payment.price,
            currency: payment.curr,
            testMode: payment.test,
            merchantId: config.merchantId,
          },
        };
      } catch (error) {
        return { found: false, error: failure("getPayment", error) };
      }
    },
    verifyNotification(input: unknown): boolean {
      if (!configured) return false;
      if (input instanceof URLSearchParams) {
        const form = input;
        if (
          Array.from(form.keys()).some((key) => form.getAll(key).length !== 1)
        )
          return false;
        input = Object.fromEntries(input);
      }
      const parsed = notificationSchema.safeParse(input);
      return (
        parsed.success &&
        safeEqual(parsed.data.secret, config.secret) &&
        safeEqual(parsed.data.merchant, config.merchantId) &&
        parsed.data.test === config.testMode
      );
    },
  };
}

export function isComgateConfigured(): boolean {
  return (
    !(env.VERCEL_ENV === "production" && env.COMGATE_TEST_MODE === "true") &&
    hasEnv("COMGATE_MERCHANT_ID", "COMGATE_SECRET") &&
    !!env.COMGATE_MERCHANT_ID?.trim() &&
    !!env.COMGATE_SECRET?.trim()
  );
}
let client: ReturnType<typeof createComgateClient> | undefined;
function getClient() {
  if (!client) {
    const keys = requireEnv("COMGATE_MERCHANT_ID", "COMGATE_SECRET");
    client = createComgateClient({
      merchantId: keys.COMGATE_MERCHANT_ID,
      secret: keys.COMGATE_SECRET,
      testMode: env.COMGATE_TEST_MODE === "true",
    });
  }
  return client;
}
export async function createComgatePayment(
  params: CreateComgatePaymentParams,
): Promise<CreateComgatePaymentResult> {
  if (!isComgateConfigured())
    return {
      created: false,
      error: "comgate_not_configured",
      ambiguous: false,
    };
  return getClient().createPayment(params);
}
export async function getComgatePayment(
  id: string,
): Promise<GetComgatePaymentResult> {
  if (!isComgateConfigured())
    return { found: false, error: "comgate_not_configured" };
  return getClient().getPayment(id);
}
/** Authentication only. Caller MUST fetch status and verify the stored payment binding. */
export function verifyComgateNotification(input: unknown): boolean {
  return isComgateConfigured() && getClient().verifyNotification(input);
}
