import { readBodyBytes, BodyReadError } from "@/lib/helpers/limited-body";
import { NextResponse, type NextRequest } from "next/server";
import { verifyComgateNotification } from "@/lib/integrations/comgate";
import { synchronizeComgatePayment } from "@/lib/services/payments";
import { logger } from "@/lib/helpers/logger";

export const maxDuration = 300;
export async function POST(request: NextRequest) {
  let raw: string;
  try {
    raw = (await readBodyBytes(request, 16_384)).toString("utf8");
  } catch (error) {
    return new NextResponse(null, {
      status:
        error instanceof BodyReadError
          ? error.reason === "too_large"
            ? 413
            : 408
          : 400,
    });
  }
  let body: unknown;
  try {
    body = request.headers.get("content-type")?.includes("application/json")
      ? JSON.parse(raw)
      : new URLSearchParams(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  if (!verifyComgateNotification(body))
    return new NextResponse(null, { status: 403 });
  const id =
    body instanceof URLSearchParams
      ? body.get("transId")!
      : String((body as { transId: unknown }).transId);
  try {
    const known = await synchronizeComgatePayment(id);
    // The provider may notify before the create response has been persisted.
    if (!known) return new NextResponse(null, { status: 503 });
    return new NextResponse("OK", {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    // Never log request bodies: Comgate notifications contain the shared secret.
    logger.error("Payment notification could not be processed", {
      where: "comgate.webhook",
    });
    return new NextResponse(null, { status: 503 });
  }
}
