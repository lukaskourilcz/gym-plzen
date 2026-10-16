import { NextRequest, NextResponse } from "next/server";
import { isDateKey } from "@/lib/helpers/datetime";
import { loadCalendarAvailability } from "@/lib/services/calendar-availability";
import { logger } from "@/lib/helpers/logger";
export const dynamic = "force-dynamic";
export const maxDuration = 20;
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date"),
    month = request.nextUrl.searchParams.get("month");
  const headers = { "Cache-Control": "no-store" };
  if (
    (date !== null && !isDateKey(date)) ||
    (month !== null &&
      (!/^\d{4}-\d{2}$/.test(month) || !isDateKey(`${month}-01`)))
  )
    return NextResponse.json(
      { error: "invalid_date" },
      { status: 400, headers },
    );
  try {
    const { view } = await loadCalendarAvailability({ date, month });
    return NextResponse.json(view, { headers });
  } catch (error) {
    logger.warn("Calendar snapshot unavailable", { error });
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers },
    );
  }
}
