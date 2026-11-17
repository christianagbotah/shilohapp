import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import type { OrderStatus, PaymentStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.enum(["pending", "reviewing", "contacted", "fulfilled", "cancelled"]).optional(),
  paymentStatus: z.enum(["unpaid", "verifying", "paid"]).optional(),
  adminNotes: z.string().max(500).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const existing = await db.order.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updated = await db.order.update({ where: { id }, data: parsed.data });
    return NextResponse.json({
      order: {
        id: updated.id,
        status: updated.status as OrderStatus,
        paymentStatus: updated.paymentStatus as PaymentStatus,
        adminNotes: updated.adminNotes,
      },
    });
  } catch (err) {
    console.error("PATCH /api/admin/orders/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}
