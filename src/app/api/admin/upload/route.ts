import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import { isAdminRequest } from "@/lib/admin-auth";
import { listMediaLibrary } from "@/lib/media-library";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PIXELS = 24_000_000;
const PUBLIC_DIR = path.join(process.cwd(), "public");
// On the VPS uploads live outside versioned releases, and /products/ is
// served by Nginx from that persistent directory.
const PRODUCTS_DIR = process.env.SHILOH_MEDIA_DIR || path.join(PUBLIC_DIR, "products");

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const items = await listMediaLibrary(PUBLIC_DIR, process.env.SHILOH_MEDIA_DIR);
    return NextResponse.json({
      items,
      // Kept for older integrations of this endpoint.
      images: items.map((item) => item.path),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    console.error("Admin image listing failed", err);
    return NextResponse.json({ error: "Image gallery is unavailable" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    // Prevent obviously oversized multipart requests before loading file bytes.
    const bodySize = Number(req.headers.get("content-length"));
    if (Number.isFinite(bodySize) && bodySize > MAX_BYTES + 512 * 1024) {
      return NextResponse.json({ error: "Upload exceeds the 4 MB file limit" }, { status: 413 });
    }
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image" }, { status: 400 });
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: "Use JPEG, PNG or WebP" }, { status: 415 });
    }
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Maximum image size is 4 MB" }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.length > MAX_BYTES) return NextResponse.json({ error: "Image exceeds upload limit" }, { status: 413 });
    // MIME headers and extensions are untrusted. Decode and re-encode to
    // remove EXIF and any trailing executable payloads.
    const parser = sharp(bytes, { limitInputPixels: MAX_PIXELS, failOn: "error" });
    const meta = await parser.metadata();
    if (!meta.width || !meta.height || !["jpeg", "png", "webp"].includes(meta.format || "")) {
      return NextResponse.json({ error: "Image content could not be validated" }, { status: 415 });
    }
    const output = await parser.rotate()
      .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 86, effort: 4 }).toBuffer();

    const slug = file.name.replace(/\.[^.]+$/, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 35) || "image";
    const filename = [Date.now(), randomBytes(6).toString("hex"), slug].join("-") + ".webp";
    await mkdir(PRODUCTS_DIR, { recursive: true });
    await writeFile(path.join(PRODUCTS_DIR, filename), output, { flag: "wx" });
    return NextResponse.json({ path: "/products/" + filename }, { status: 201 });
  } catch (err) {
    console.error("Admin image upload failed", err);
    return NextResponse.json({ error: "Image could not be processed; try a smaller valid picture" }, { status: 422 });
  }
}