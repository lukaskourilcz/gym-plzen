import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/helpers/cron";
import { entryLog } from "@/lib/services";

/**
 * Periodic Nuki entry-log sync (belt-and-suspenders alongside the webhook), so
 * the "kniha vstupů" stays accurate even if a webhook delivery is missed.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await entryLog.syncEntryLog(50);
  return NextResponse.json({ ok: true, ...result });
}
