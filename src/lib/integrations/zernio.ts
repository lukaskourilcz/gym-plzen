import { requireEnv } from "@/lib/env";
import { HttpError, httpRequest } from "@/lib/helpers/http";
import {
  zernioAccessPayload,
  zernioMessageId,
} from "@/lib/helpers/zernio-access";

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
    return id
      ? { sent: true as const, providerMessageId: id }
      : {
          sent: false as const,
          error: "zernio_send_unconfirmed_no_message_id",
        };
  } catch (e) {
    if (e instanceof HttpError) {
      const detail =
        e.body && typeof e.body === "object"
          ? (e.body as { error?: unknown; message?: unknown })
          : {};
      const message =
        typeof detail.error === "string"
          ? detail.error
          : typeof detail.message === "string"
            ? detail.message
            : "request_rejected";
      return {
        sent: false as const,
        error: `Zernio HTTP ${e.status}: ${message}`.slice(0, 500),
      };
    }
    return {
      sent: false as const,
      error: "zernio_send_unconfirmed_network_error",
    };
  }
}
