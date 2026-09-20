import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/helpers/cron";
import { purgeExpiredEmails } from "@/lib/services/email-archive";

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, deleted: await purgeExpiredEmails() });
}
