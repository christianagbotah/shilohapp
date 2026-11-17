import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { toProductDTO } from "@/lib/store-utils";
import type { AdminProductDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

const colorSchema = z.object({
  name: z.string().min(1).max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "Colour must be a hex value"),
});

const gallerySchema = z.object({
  src: z.string().min(1).max(500),
  label: z.string().min(1).max(40),
});

export const productSchema = z.object({
  type: z.enum(["tshirt", "lacoste", "jersey", "cap"]),
  ageGroup: z.enum(["adult", "kid"]),
  name: z.string().min(1).max(80),
  tagline: z.string().max(200).nullish(),
  price: z.number().min(0).max(9999),
  image: z.string().min(1).max(500),
  gallery: z.array(gallerySchema).max(8),
  colors: z.array(colorSchema).min(1).max(12),
  sizes: z.array(z.string().min(1).max(12)).min(1).max(12),
  capStyles: z.array(z.string().min(1).max(20)).max(4).nullish(),
  badge: z.string().max(24).nullish(),
  sortOrder: z.number().int().min(0).max(999).optional(),
  active: z.boolean().optional(),
});

const patchSchema = productSchema.partial();

/** Serialize validated payload into Prisma JSON-string columns */
function toJsonData(data: z.infer<typeof productSchema>) {
  return {
    type: data.type,
    ageGroup: data.ageGroup,
    name: data.name.trim(),
    tagline: data.tagline?.trim() || null,
    price: data.price,
    image: data.image.trim(),
    gallery: data.gallery.length ? JSON.stringify(data.gallery) : null,
    colors: JSON.stringify(data.colors),
    sizes: JSON.stringify(data.sizes),
    capStyles: data.capStyles?.length ? JSON.stringify(data.capStyles) : null,
    badge: data.badge?.trim() || null,
  };
}

/** GET /api/admin/products — full catalogue, including deactivated items */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const rows = await db.product.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
    const products: AdminProductDTO[] = rows.map((row) => ({
      ...toProductDTO(row),
      sortOrder: row.sortOrder,
      active: row.active,
    }));
    return NextResponse.json({ products });
  } catch (err) {
    console.error("GET /api/admin/products failed:", err);
    return NextResponse.json({ error: "Failed to load products" }, { status: 500 });
  }
}

/** POST /api/admin/products — create a product */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const parsed = productSchema.safeParse(await req.json());
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `${issue.path.join(".") || "Form"}: ${issue.message}` },
        { status: 400 }
      );
    }

    // New products go to the end of the rack unless a position is given
    const maxOrder = await db.product.aggregate({ _max: { sortOrder: true } });
    const sortOrder =
      parsed.data.sortOrder ?? (maxOrder._max.sortOrder != null ? maxOrder._max.sortOrder + 1 : 0);

    const created = await db.product.create({
      data: { ...toJsonData(parsed.data), sortOrder, active: parsed.data.active ?? true },
    });

    return NextResponse.json({ product: { id: created.id } }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/products failed:", err);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
}
