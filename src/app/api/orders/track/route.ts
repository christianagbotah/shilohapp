import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeGhPhone } from "@/lib/format";
import type { OrderDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

/**
 * Track orders by order code (e.g. SHL-7K2P9Q) or phone number.
 * Returns a sanitized list (no address / admin notes).
 */
export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 4) {
      return NextResponse.json({ error: "Enter your order code or phone number" }, { status: 400 });
    }

    const upper = q.toUpperCase();
    const phone = normalizeGhPhone(q);
    const codeMatch = upper.match(/^SHL-[A-HJ-NP-Z2-9]{6}$/);

    const orders = await db.order.findMany({
      where: codeMatch ? { code: upper } : phone ? { phone } : { code: upper },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    const dtos: OrderDTO[] = orders.map((order) => ({
      id: order.id,
      code: order.code,
      fullName: order.fullName,
      phone: order.phone,
      address: null,
      status: order.status as OrderDTO["status"],
      paymentStatus: order.paymentStatus as OrderDTO["paymentStatus"],
      subtotal: order.subtotal,
      total: order.total,
      adminNotes: null,
      createdAt: order.createdAt.toISOString(),
      items: order.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        productType: i.productType as OrderDTO["items"][number]["productType"],
        ageGroup: i.ageGroup as OrderDTO["items"][number]["ageGroup"],
        color: i.color,
        size: i.size,
        capStyle: i.capStyle,
        unitPrice: i.unitPrice,
        quantity: i.quantity,
      })),
    }));

    return NextResponse.json({ orders: dtos });
  } catch (err) {
    console.error("GET /api/orders/track failed:", err);
    return NextResponse.json({ error: "Could not look up your order" }, { status: 500 });
  }
}
