import { NextResponse, type NextRequest } from "next/server";
import { readLimitedBody } from "@/lib/integrations/instagram";
import {
  verifyInstagramSignedRequest,
  instagramDeletionReceipt,
} from "@/lib/helpers/instagram-vault";
import { instagramOrigin } from "@/lib/helpers/instagram-oauth";
import { disconnectInstagram } from "@/lib/services/instagram";
import { invalidateInstagram } from "@/lib/services/instagram-cache";
/** Both Meta deauthorization and data-deletion callbacks remove only this integration's data. */
export async function POST(request: NextRequest) {
  let verified = false;
  try {
    const bytes = await readLimitedBody(request, 32_768);
    const signed = new URLSearchParams(bytes.toString("utf8")).get(
      "signed_request",
    );
    if (!signed)
      return NextResponse.json({ error: "invalid_request" }, { status: 400 });
    const grant = verifyInstagramSignedRequest(signed);
    verified = true;
    await disconnectInstagram(grant);
    invalidateInstagram();
    const confirmation = instagramDeletionReceipt();
    const url = new URL(
      "/api/instagram/deletion-status",
      instagramOrigin(request.url),
    );
    url.searchParams.set("code", confirmation);
    return NextResponse.json(
      { url: url.toString(), confirmation_code: confirmation },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { error: verified ? "temporarily_unavailable" : "invalid_request" },
      { status: verified ? 503 : 400 },
    );
  }
}
