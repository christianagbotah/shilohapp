import { readdir, stat } from "node:fs/promises";
import path from "node:path";

export type MediaItem = {
  path: string;
  name: string;
  folder: "Products" | "Website";
  bytes: number;
  updatedAt: string;
};

const IMAGE_FILE = /\.(jpe?g|png|webp|gif)$/i;
const MAX_ITEMS_PER_FOLDER = 1200;

/**
 * Only scan approved, local public-media folders. Never accept directory
 * locations from requests or follow arbitrary symlinks for file entries.
 */
export async function listMediaLibrary(publicDir: string, storedProductsDir?: string): Promise<MediaItem[]> {
  const folders: { dir: string; url: string; folder: MediaItem["folder"] }[] = [
    { dir: path.join(publicDir, "products"), url: "/products/", folder: "Products" },
    { dir: path.join(publicDir, "images"), url: "/images/", folder: "Website" },
  ];
  if (storedProductsDir) {
    // Deployed uploaded files outlive Next.js release directories.
    folders.unshift({ dir: storedProductsDir, url: "/products/", folder: "Products" });
  }

  const found = new Map<string, MediaItem>();
  for (const folder of folders) {
    let files;
    try {
      files = await readdir(folder.dir, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    for (const file of files.slice(0, MAX_ITEMS_PER_FOLDER)) {
      if (!file.isFile() || !IMAGE_FILE.test(file.name)) continue;
      const webPath = folder.url + encodeURIComponent(file.name);
      if (found.has(webPath)) continue;
      const info = await stat(path.join(folder.dir, file.name));
      found.set(webPath, {
        path: webPath,
        name: file.name,
        folder: folder.folder,
        bytes: info.size,
        updatedAt: info.mtime.toISOString(),
      });
    }
  }

  // Include the existing social sharing image where available.
  const social = path.join(publicDir, "og-shiloh.jpg");
  try {
    const info = await stat(social);
    if (info.isFile()) {
      found.set("/og-shiloh.jpg", {
        path: "/og-shiloh.jpg",
        name: "og-shiloh.jpg",
        folder: "Website",
        bytes: info.size,
        updatedAt: info.mtime.toISOString(),
      });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return [...found.values()].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt) || a.name.localeCompare(b.name)
  );
}
