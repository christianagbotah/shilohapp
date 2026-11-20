import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { finalizePaymentFromHubtel } from "@/lib/payments";

export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const order = await db.order.findUnique({ where: { id }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  try {
    const outcome = await finalizePaymentFromHubtel(order);
    return NextResponse.json(outcome, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("Admin reconciliation failed", err);
    return NextResponse.json({ error: "Hubtel verification unavailable. Try again shortly." }, { status: 503 });
  }
}
