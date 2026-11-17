import { NextRequest, NextResponse } from "next/server";
import { mkdir, readdir, writeFile } from "fs/promises";
import path from "path";
import { isAdminRequest } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const PRODUCTS_DIR = path.join(process.cwd(), "public", "products");

/**
 * GET /api/admin/upload — list images already available in /public/products
 * so the product editor can offer them as quick picks.
 */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await mkdir(PRODUCTS_DIR, { recursive: true });
    const files = await readdir(PRODUCTS_DIR);
    const images = files
      .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
      .sort()
      .map((f) => `/products/${f}`);
    return NextResponse.json({ images });
  } catch (err) {
    console.error("GET /api/admin/upload failed:", err);
    return NextResponse.json({ error: "Failed to list images" }, { status: 500 });
  }
}

/**
 * POST /api/admin/upload — multipart image upload, stored in /public/products.
 * Returns the public path to use as the product's image / gallery src.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    const ext = ALLOWED[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: "Only JPG, PNG or WebP images are supported" },
        { status: 415 }
      );
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be 4 MB or smaller" }, { status: 413 });
    }

    await mkdir(PRODUCTS_DIR, { recursive: true });
    // Keep a readable slug from the original name, guarantee uniqueness with a timestamp
    const slug =
      file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "image";
    const filename = `${Date.now()}-${slug}.${ext}`;
    await writeFile(path.join(PRODUCTS_DIR, filename), buffer);

    return NextResponse.json({ path: `/products/${filename}` }, { status: 201 });
  } catch (err) {
    console.error("POST /api/admin/upload failed:", err);
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 });
  }
}
