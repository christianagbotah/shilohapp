import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { generateOrderCode, normalizeGhPhone } from "@/lib/format";
import type { OrderDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const itemSchema = z.object({
  productId: z.string().min(1),
  color: z.string().min(1).max(40),
  size: z.string().min(1).max(20),
  capStyle: z.string().min(1).max(20).nullable().optional(),
  quantity: z.number().int().min(1).max(99),
});

const createOrderSchema = z.object({
  fullName: z.string().trim().min(3, "Please enter your full name").max(80),
  phone: z.string().trim().min(9).max(20),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  items: z.array(itemSchema).min(1, "Your cart is empty").max(30),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid order details" },
        { status: 400 }
      );
    }
    const { fullName, phone, address, items } = parsed.data;

    const normalizedPhone = normalizeGhPhone(phone);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: "Enter a valid Ghana phone number, e.g. 024 123 4567" },
        { status: 400 }
      );
    }

    // Load products and validate every line item server-side
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await db.product.findMany({ where: { id: { in: productIds }, active: true } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const preparedItems: Array<{
      productId: string;
      productName: string;
      productType: string;
      ageGroup: string;
      color: string;
      size: string;
      capStyle: string | null;
      unitPrice: number;
      quantity: number;
    }> = [];

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return NextResponse.json({ error: "One of the items is no longer available" }, { status: 400 });
      }
      let sizes: string[] = [];
      let colors: Array<{ name: string; hex: string }> = [];
      try {
        sizes = JSON.parse(product.sizes);
        colors = JSON.parse(product.colors);
      } catch {
        // fall through to raw checks below
      }
      if (!sizes.includes(item.size)) {
        return NextResponse.json(
          { error: `Invalid size for ${product.name}` },
          { status: 400 }
        );
      }
      if (!colors.some((c) => c.name === item.color)) {
        return NextResponse.json(
          { error: `Invalid colour for ${product.name}` },
          { status: 400 }
        );
      }
      if (product.type === "cap") {
        let capStyles: string[] = [];
        try {
          capStyles = product.capStyles ? JSON.parse(product.capStyles) : [];
        } catch {
          capStyles = [];
        }
        if (capStyles.length > 0 && (!item.capStyle || !capStyles.includes(item.capStyle))) {
          return NextResponse.json(
            { error: `Choose soft or hard style for ${product.name}` },
            { status: 400 }
          );
        }
      }
      preparedItems.push({
        productId: product.id,
        productName: product.name,
        productType: product.type,
        ageGroup: product.ageGroup,
        color: item.color,
        size: item.size,
        capStyle: product.type === "cap" ? (item.capStyle ?? null) : null,
        unitPrice: product.price,
        quantity: item.quantity,
      });
    }

    const subtotal = preparedItems.reduce((n, i) => n + i.unitPrice * i.quantity, 0);
    const total = Math.round(subtotal * 100) / 100;

    // Unique, human-friendly order code (used as the MoMo payment reference)
    let code = generateOrderCode();
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await db.order.findUnique({ where: { code } });
      if (!clash) break;
      code = generateOrderCode();
    }

    const order = await db.order.create({
      data: {
        code,
        fullName,
        phone: normalizedPhone,
        address: address ? address : null,
        status: "pending",
        paymentStatus: "unpaid",
        subtotal,
        total,
        items: { create: preparedItems },
      },
      include: { items: true },
    });

    const dto: OrderDTO = {
      ...order,
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
    };

    return NextResponse.json({ order: dto }, { status: 201 });
  } catch (err) {
    console.error("POST /api/orders failed:", err);
    return NextResponse.json({ error: "Could not place your order. Please try again." }, { status: 500 });
  }
}
