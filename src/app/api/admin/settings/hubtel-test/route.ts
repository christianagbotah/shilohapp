import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { testHubtelConnection } from "@/lib/hubtel";

export const dynamic = "force-dynamic";

/**
 * Admin-only: verify the SAVED Hubtel credentials by initiating a
 * ₵0.01 test checkout session against the live Hubtel API — the exact
 * endpoint real payments use. Nothing is charged; the session simply
 * proves the API Username, API Key and Merchant Account Number work.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await testHubtelConnection(req.nextUrl.origin);
    if (result.ok) {
      return NextResponse.json({ success: true, message: result.message });
    }
    return NextResponse.json(
      { success: false, inconclusive: result.inconclusive ?? false, error: result.error, hint: result.hint },
      { status: 400 }
    );
  } catch (err) {
    console.error("POST /api/admin/settings/hubtel-test failed:", err);
    return NextResponse.json({ error: "Test failed — please try again." }, { status: 500 });
  }
}
