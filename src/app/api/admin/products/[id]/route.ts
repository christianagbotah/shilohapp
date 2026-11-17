import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const colorSchema = z.object({
  name: z.string().min(1).max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/, "Colour must be a hex value"),
});

const gallerySchema = z.object({
  src: z.string().min(1).max(500),
  label: z.string().min(1).max(40),
});

const patchSchema = z
  .object({
    type: z.enum(["tshirt", "lacoste", "jersey", "cap"]).optional(),
    ageGroup: z.enum(["adult", "kid"]).optional(),
    name: z.string().min(1).max(80).optional(),
    tagline: z.string().max(200).nullish(),
    price: z.number().min(0).max(9999).optional(),
    image: z.string().min(1).max(500).optional(),
    gallery: z.array(gallerySchema).max(8).optional(),
    colors: z.array(colorSchema).min(1).max(12).optional(),
    sizes: z.array(z.string().min(1).max(12)).min(1).max(12).optional(),
    capStyles: z.array(z.string().min(1).max(20)).max(4).nullish(),
    badge: z.string().max(24).nullish(),
    sortOrder: z.number().int().min(0).max(999).optional(),
    active: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Nothing to update",
  });

/** PATCH /api/admin/products/[id] — edit price, variants, visibility… */
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
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json(
        { error: `${issue.path.join(".") || "Form"}: ${issue.message}` },
        { status: 400 }
      );
    }

    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const d = parsed.data;
    const data: Record<string, unknown> = {
      ...(d.type !== undefined ? { type: d.type } : {}),
      ...(d.ageGroup !== undefined ? { ageGroup: d.ageGroup } : {}),
      ...(d.name !== undefined ? { name: d.name.trim() } : {}),
      ...(d.tagline !== undefined ? { tagline: d.tagline?.trim() || null } : {}),
      ...(d.price !== undefined ? { price: d.price } : {}),
      ...(d.image !== undefined ? { image: d.image.trim() } : {}),
      ...(d.gallery !== undefined
        ? { gallery: d.gallery.length ? JSON.stringify(d.gallery) : null }
        : {}),
      ...(d.colors !== undefined ? { colors: JSON.stringify(d.colors) } : {}),
      ...(d.sizes !== undefined ? { sizes: JSON.stringify(d.sizes) } : {}),
      ...(d.capStyles !== undefined
        ? { capStyles: d.capStyles?.length ? JSON.stringify(d.capStyles) : null }
        : {}),
      ...(d.badge !== undefined ? { badge: d.badge?.trim() || null } : {}),
      ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
      ...(d.active !== undefined ? { active: d.active } : {}),
    };

    await db.product.update({ where: { id }, data });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/admin/products/[id] failed:", err);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/products/[id] — remove a product permanently.
 * Guarded: products referenced by past orders can't be hard-deleted
 * (order history must stay intact) — deactivate instead.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const existing = await db.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const soldCount = await db.orderItem.count({ where: { productId: id } });
    if (soldCount > 0) {
      return NextResponse.json(
        {
          error:
            "This product appears in past orders, so it can't be deleted permanently — deactivate it instead to hide it from the store.",
        },
        { status: 409 }
      );
    }

    await db.product.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/admin/products/[id] failed:", err);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}
