import { isHeroDateAllowed } from "@/lib/helpers/hero-availability";
import { NextResponse } from "next/server";
import { getHeroDay } from "@/lib/services/hero-availability";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  const now = new Date();
  const headers = { "Cache-Control": "no-store" };
  if (!isHeroDateAllowed(date, now))
    return NextResponse.json(
      { error: "Neplatné datum." },
      { status: 400, headers },
    );
  try {
    const result = await getHeroDay(date, now);
    if (result) return NextResponse.json(result, { headers });
  } catch {
    /* A failed read must not look like an empty day. */
  }
  return NextResponse.json(
    { error: "Dostupnost nelze načíst." },
    { status: 503, headers },
  );
}
