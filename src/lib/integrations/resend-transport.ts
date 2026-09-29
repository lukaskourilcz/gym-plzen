import { httpRequest, HttpError } from "@/lib/helpers/http";
import type { SendEmailParams, SendEmailResult } from "./resend";

/** A timed, single-attempt POST; retry only an explicit rate-limit refusal. */
export function createResendSender(
  config: {
    apiKey: string;
    from: string;
    baseUrl?: string;
    timeoutMs?: number;
    rateLimitPauseMs?: number;
  },
  request: typeof httpRequest = httpRequest,
) {
  return async (params: SendEmailParams): Promise<SendEmailResult> => {
    const headers: Record<string, string> = {
      authorization: `Bearer ${config.apiKey}`,
    };
    if (params.idempotencyKey)
      headers["Idempotency-Key"] = params.idempotencyKey;
    const send = () =>
      request<unknown>(
        `${(config.baseUrl ?? "https://api.resend.com").replace(/\/$/, "")}/emails`,
        {
          method: "POST",
          headers,
          json: {
            from: config.from,
            to: params.to,
            subject: params.subject,
            html: params.html,
            text: params.text,
            reply_to: params.replyTo,
            attachments: params.attachments?.length
              ? params.attachments.map(({ filename, content }) => ({
                  filename,
                  content,
                }))
              : undefined,
          },
          timeoutMs: config.timeoutMs ?? 15_000,
          retries: 0,
        },
      );
    try {
      let response: unknown;
      try {
        response = await send();
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 429) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, config.rateLimitPauseMs ?? 1_100),
        );
        response = await send();
      }
      const id =
        response && typeof response === "object" && "id" in response
          ? response.id
          : null;
      if (typeof id !== "string" || !id.trim())
        return { sent: false, error: "resend_send_unconfirmed_no_message_id" };
      return { sent: true, providerMessageId: id };
    } catch (error) {
      // Provider bodies may contain message content or credentials. Only a
      // fixed classification leaves this boundary, never the raw exception.
      return {
        sent: false,
        error:
          error instanceof HttpError
            ? `resend_http_${error.status}`
            : "resend_network_unconfirmed",
      };
    }
  };
}
