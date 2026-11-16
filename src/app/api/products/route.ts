import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { toProductDTO } from "@/lib/store-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.product.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    });
    return NextResponse.json({ products: rows.map(toProductDTO) });
  } catch (err) {
    console.error("GET /api/products failed:", err);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}
