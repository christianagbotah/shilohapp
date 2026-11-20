import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isAdminRequest, revokeAdminSession } from "@/lib/admin-auth";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: await isAdminRequest(req) }, { headers: { "Cache-Control": "no-store" } });
}
export async function DELETE(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await revokeAdminSession(req);
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(ADMIN_COOKIE);
  return response;
}
