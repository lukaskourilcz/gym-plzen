import { requireEnv } from "@/lib/env";
import { HttpError, httpRequest } from "@/lib/helpers/http";
import { logger } from "@/lib/helpers/logger";
import {
  zernioAccessPayload,
  zernioMessageId,
} from "@/lib/helpers/zernio-access";

/** The provider's error text with every run of digits removed (PINs, phones). */
export function redactedReason(body: unknown): string {
  const record =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const nested =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : {};
  const text = [
    record.code,
    record.error && typeof record.error !== "object" ? record.error : null,
    record.message,
    nested.code,
    nested.message,
    nested.type,
  ]
    .filter((part) => typeof part === "string" || typeof part === "number")
    .join(" | ");
  return (text || (typeof body === "string" ? body : ""))
    .replace(/\d+/g, "#")
    .slice(0, 300);
}

/** No automatic POST retries: a timeout may mean Meta already accepted the PIN. */
export async function sendZernioAccessCode(
  input: Omit<Parameters<typeof zernioAccessPayload>[0], "accountId">,
) {
  const { ZERNIO_API_KEY, ZERNIO_ACCOUNT_ID } = requireEnv(
    "ZERNIO_API_KEY",
    "ZERNIO_ACCOUNT_ID",
  );
  try {
    const response = await httpRequest<unknown>(
      "https://zernio.com/api/v1/inbox/conversations",
      {
        method: "POST",
        cache: "no-store",
        retries: 0,
        headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` },
        json: zernioAccessPayload({ ...input, accountId: ZERNIO_ACCOUNT_ID }),
      },
    );
    const id = zernioMessageId(response);
    const conversationId = (response as { data?: { conversationId?: unknown } })
      ?.data?.conversationId;
    return id
      ? {
          sent: true as const,
          providerMessageId: id,
          conversationId:
            typeof conversationId === "string" ? conversationId : null,
        }
      : {
          sent: false as const,
          error: "zernio_send_unconfirmed_no_message_id",
        };
  } catch (e) {
    if (e instanceof HttpError) {
      // Provider responses may echo template variables (including the PIN),
      // so only a redacted summary of the reason is ever logged.
      logger.warn("Zernio rejected a WhatsApp message", {
        status: e.status,
        reason: redactedReason(e.body),
      });
      return { sent: false as const, error: `zernio_http_${e.status}` };
    }
    return {
      sent: false as const,
      error: "zernio_send_unconfirmed_network_error",
    };
  }
}

/** Return only status; message bodies/PINs must never escape this adapter. */
export async function readZernioDelivery(
  conversationId: string,
  messageId: string,
) {
  const { ZERNIO_API_KEY, ZERNIO_ACCOUNT_ID } = requireEnv(
    "ZERNIO_API_KEY",
    "ZERNIO_ACCOUNT_ID",
  );
  let cursor: string | undefined;
  for (let page = 0; page < 5; page++) {
    const query = new URLSearchParams({
      accountId: ZERNIO_ACCOUNT_ID,
      limit: "100",
      sortOrder: "desc",
    });
    if (cursor) query.set("cursor", cursor);
    const result = await httpRequest<{
      messages?: Array<{
        id: string;
        accountId: string;
        direction: string;
        deliveryStatus?: string;
        deliveryError?: { code?: number };
      }>;
      pagination?: { hasMore?: boolean; nextCursor?: string };
    }>(
      `https://zernio.com/api/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages?${query}`,
      {
        headers: { Authorization: `Bearer ${ZERNIO_API_KEY}` },
        cache: "no-store",
        timeoutMs: 5000,
      },
    );
    const message = result.messages?.find(
      (m) =>
        m.id === messageId &&
        m.accountId === ZERNIO_ACCOUNT_ID &&
        m.direction === "outgoing",
    );
    if (message)
      return {
        status: ["sent", "delivered", "read", "failed"].includes(
          message.deliveryStatus ?? "",
        )
          ? (message.deliveryStatus as "sent" | "delivered" | "read" | "failed")
          : ("unknown" as const),
        errorCode: message.deliveryError?.code,
      };
    if (!result.pagination?.hasMore || !result.pagination.nextCursor) break;
    cursor = result.pagination.nextCursor;
  }
  return { status: "unknown" as const };
}
