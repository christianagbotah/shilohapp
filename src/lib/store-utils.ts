import type { ProductDTO } from "@/lib/types";
import { db } from "@/lib/db";

// Server-only helpers. Pure client-safe helpers live in @/lib/format.

/** Map a Prisma product row to a DTO with parsed JSON fields */
export function toProductDTO(row: {
  id: string;
  type: string;
  ageGroup: string;
  name: string;
  tagline: string | null;
  price: number;
  image: string;
  colors: string;
  sizes: string;
  capStyles: string | null;
  badge: string | null;
}): ProductDTO {
  let colors: ProductDTO["colors"] = [];
  let sizes: string[] = [];
  let capStyles: string[] | null = null;
  try {
    colors = JSON.parse(row.colors);
  } catch {
    colors = [];
  }
  try {
    sizes = JSON.parse(row.sizes);
  } catch {
    sizes = [];
  }
  if (row.capStyles) {
    try {
      capStyles = JSON.parse(row.capStyles);
    } catch {
      capStyles = null;
    }
  }
  return {
    id: row.id,
    type: row.type as ProductDTO["type"],
    ageGroup: row.ageGroup as ProductDTO["ageGroup"],
    name: row.name,
    tagline: row.tagline,
    price: row.price,
    image: row.image,
    colors,
    sizes,
    capStyles,
    badge: row.badge,
  };
}

/** Fetch a public store setting value (or null) */
export async function getSetting(key: string): Promise<string | null> {
  const row = await db.setting.findUnique({ where: { key } });
  return row?.value ?? null;
}
