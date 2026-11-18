import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import type { AdminStats, OrderDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const orders = await db.order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const dtos: OrderDTO[] = orders.map((order) => ({
      id: order.id,
      code: order.code,
      fullName: order.fullName,
      phone: order.phone,
      address: order.address,
      status: order.status as OrderDTO["status"],
      paymentStatus: order.paymentStatus as OrderDTO["paymentStatus"],
      paymentMethod: order.paymentMethod,
      paidAt: order.paidAt ? order.paidAt.toISOString() : null,
      subtotal: order.subtotal,
      total: order.total,
      adminNotes: order.adminNotes,
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

    const stats: AdminStats = {
      totalOrders: orders.length,
      pendingReview: orders.filter((o) => o.status === "pending").length,
      verifyingPayment: orders.filter((o) => o.paymentStatus === "verifying").length,
      paidRevenue: orders
        .filter((o) => o.paymentStatus === "paid")
        .reduce((n, o) => n + o.total, 0),
      totalUnits: orders
        .filter((o) => o.status !== "cancelled")
        .reduce((n, o) => n + o.items.reduce((m, i) => m + i.quantity, 0), 0),
    };

    return NextResponse.json({ orders: dtos, stats });
  } catch (err) {
    console.error("GET /api/admin/orders failed:", err);
    return NextResponse.json({ error: "Failed to load orders" }, { status: 500 });
  }
}
