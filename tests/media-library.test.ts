import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { listMediaLibrary } from "../src/lib/media-library";

const tempDirs: string[] = [];
async function directories() {
  const base = await mkdtemp(path.join(os.tmpdir(), "shiloh-media-test-"));
  tempDirs.push(base);
  const publicDir = path.join(base, "public");
  const storedProductsDir = path.join(base, "data", "products");
  await mkdir(path.join(publicDir, "products"), { recursive: true });
  await mkdir(path.join(publicDir, "images"), { recursive: true });
  await mkdir(storedProductsDir, { recursive: true });
  return { publicDir, storedProductsDir };
}

afterEach(async () => {
  while (tempDirs.length) await rm(tempDirs.pop()!, { recursive: true, force: true });
});

describe("Shiloh website media library", () => {
  test("combines deployed product images, site images, and existing social artwork", async () => {
    const dirs = await directories();
    await writeFile(path.join(dirs.publicDir, "products", "shirt.jpg"), "preview");
    await writeFile(path.join(dirs.publicDir, "images", "flyer.png"), "preview");
    await writeFile(path.join(dirs.publicDir, "og-shiloh.jpg"), "preview");
    const items = await listMediaLibrary(dirs.publicDir);
    expect(items.map((x) => x.path).sort()).toEqual([
      "/images/flyer.png", "/og-shiloh.jpg", "/products/shirt.jpg",
    ]);
    expect(items.find((x) => x.name === "flyer.png")?.folder).toBe("Website");
  });

  test("finds newly uploaded persistent files and deduplicates existing filenames", async () => {
    const { publicDir, storedProductsDir } = await directories();
    await writeFile(path.join(publicDir, "products", "shirt.jpg"), "one");
    await writeFile(path.join(storedProductsDir, "shirt.jpg"), "two");
    await writeFile(path.join(storedProductsDir, "new product.webp"), "new");
    const items = await listMediaLibrary(publicDir, storedProductsDir);
    expect(items.length).toBe(2);
    expect(items.find((x) => x.name === "shirt.jpg")?.bytes).toBe(3);
    expect(items.some((x) => x.path === "/products/new%20product.webp")).toBe(true);
  });

  test("never lists text, program files, directories, or outside paths", async () => {
    const { publicDir } = await directories();
    await writeFile(path.join(publicDir, "products", ".env"), "secret");
    await writeFile(path.join(publicDir, "products", "evil.svg"), "<svg/>");
    await writeFile(path.join(publicDir, "products", "test.js"), "script");
    await mkdir(path.join(publicDir, "products", "looks.webp"));
    expect(await listMediaLibrary(publicDir)).toEqual([]);
  });

  test("missing optional image folders are treated as empty", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "shiloh-media-empty-"));
    tempDirs.push(root);
    expect(await listMediaLibrary(root)).toEqual([]);
  });
});