import { NextResponse, type NextRequest } from "next/server";
import { verifyInstagramDeletionReceipt } from "@/lib/helpers/instagram-vault";
export async function GET(request: NextRequest) {
  const valid = verifyInstagramDeletionReceipt(
    request.nextUrl.searchParams.get("code") ?? "",
  );
  return NextResponse.json(
    valid
      ? {
          status: "completed",
          message: "Data propojení s Instagramem byla odstraněna.",
        }
      : { error: "not_found" },
    { status: valid ? 200 : 404, headers: { "Cache-Control": "no-store" } },
  );
}
