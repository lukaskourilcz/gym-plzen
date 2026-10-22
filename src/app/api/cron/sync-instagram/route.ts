import { NextResponse, type NextRequest } from "next/server";
import { isAuthorizedCron } from "@/lib/helpers/cron";
import { syncInstagram } from "@/lib/services/instagram";
import { invalidateInstagram } from "@/lib/services/instagram-cache";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request))
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await syncInstagram();
  // Includes an expired grant: its previously cached public posts must stop showing.
  invalidateInstagram();
  return NextResponse.json(result, {
    headers: { "Cache-Control": "no-store" },
  });
}
