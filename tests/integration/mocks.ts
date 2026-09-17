import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * Local stand-ins for the two providers the booking flow talks to. Each one
 * records what the application sent so a test can assert on the real payload
 * (the e-mail a customer would read, the amount the gateway would charge)
 * without a network, an API key or a real charge.
 */

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : null;
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve());
  });
}

export interface SentEmail {
  from: string;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: { filename: string; content: string }[];
}

/** Resend: `POST /emails` answers with an id, like the real API. */
export function createResendMock(port: number) {
  const sent: SentEmail[] = [];
  const server = createServer(async (request, response) => {
    if (request.method === "POST" && request.url === "/emails") {
      sent.push((await readJson(request)) as SentEmail);
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ id: `email-${sent.length}` }));
      return;
    }
    response.writeHead(404).end();
  });
  return {
    sent,
    start: () => listen(server, port),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export interface GatewayPayment {
  transId: string;
  refId: string;
  price: number;
  email: string;
  state: "PENDING" | "PAID" | "CANCELLED";
}

/**
 * Comgate REST 2.0: payment creation and the status lookup the application
 * treats as authoritative. The redirect points at the real gateway host, as
 * the adapter refuses anything else; a browser test intercepts it.
 */
export function createComgateMock(port: number) {
  const payments = new Map<string, GatewayPayment>();
  const creates: unknown[] = [];
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (request.method === "POST" && url.pathname === "/v2.0/payment.json") {
      const body = (await readJson(request)) as {
        refId: string;
        price: number;
        email: string;
      };
      creates.push(body);
      const transId = `TEST-${String(payments.size + 1).padStart(4, "0")}`;
      payments.set(transId, {
        transId,
        refId: body.refId,
        price: body.price,
        email: body.email,
        state: "PENDING",
      });
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          code: 0,
          message: "OK",
          transId,
          redirect: `https://payments.comgate.cz/client/instructions/index?id=${transId}`,
        }),
      );
      return;
    }
    const status = /^\/v2\.0\/payment\/transId\/(.+)\.json$/.exec(url.pathname);
    if (request.method === "GET" && status) {
      const payment = payments.get(decodeURIComponent(status[1]!));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify(
          payment
            ? {
                code: 0,
                message: "OK",
                transId: payment.transId,
                refId: payment.refId,
                status: payment.state,
                price: payment.price,
                curr: "CZK",
                test: true,
                merchant: process.env.COMGATE_MERCHANT_ID,
              }
            : { code: 1400, message: "Unknown transaction" },
        ),
      );
      return;
    }
    response.writeHead(404).end();
  });
  return {
    payments,
    creates,
    settle(transId: string, state: GatewayPayment["state"]) {
      const payment = payments.get(transId);
      if (!payment) throw new Error(`unknown gateway payment ${transId}`);
      payment.state = state;
    },
    start: () => listen(server, port),
    stop: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
