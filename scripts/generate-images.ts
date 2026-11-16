/**
 * One-off asset generator: creates consistent premium product photography
 * for the Shiloh 2026 merch store. Run: bun scripts/generate-images.ts
 */
import ZAI from "z-ai-web-dev-sdk";
import fs from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "public", "products");

const STYLE =
  "professional studio product photography, dark charcoal background, warm golden rim lighting, premium luxury brand aesthetic, high quality, detailed, centered composition";

const TASKS: Array<{ file: string; prompt: string; size: string }> = [
  {
    file: "hero.png",
    size: "1152x864",
    prompt:
      "Premium flat lay of church convocation merchandise: neatly folded black t-shirt with gold 'SHILOH' typography print, black pique polo shirt, black snapback cap with gold embroidery, subtle gold fabric accents, arranged on dark textured stone surface, cinematic moody warm golden lighting, luxury streetwear lookbook aesthetic, high quality, detailed",
  },
  {
    file: "adult-tshirt.png",
    size: "1024x1024",
    prompt: `Adult black premium heavyweight cotton t-shirt with bold gold "SHILOH 2026" gothic typography print across chest, invisible ghost mannequin display, ${STYLE}`,
  },
  {
    file: "adult-lacoste.png",
    size: "1024x1024",
    prompt: `Adult black premium pique polo shirt (lacoste style) with small embroidered gold crown logo on chest, collar and two buttons, invisible ghost mannequin display, ${STYLE}`,
  },
  {
    file: "adult-jersey.png",
    size: "1024x1024",
    prompt: `Adult deep royal purple and gold sports jersey with large gold number 26 on chest and "SHILOH" gold lettering, mesh athletic fabric, invisible ghost mannequin display, ${STYLE}`,
  },
  {
    file: "adult-cap.png",
    size: "1024x1024",
    prompt: `Adult black structured snapback cap with gold embroidered crown logo on front panel and small "SHILOH" gold script, flat brim, ${STYLE}`,
  },
  {
    file: "kid-tshirt.png",
    size: "1024x1024",
    prompt: `Kids black cotton t-shirt with playful gold and purple "SHILOH KIDS" graphic print, smaller size displayed on ghost mannequin, ${STYLE}`,
  },
  {
    file: "kid-lacoste.png",
    size: "1024x1024",
    prompt: `Kids black pique polo shirt with small gold embroidered crown logo on chest, smaller children size on ghost mannequin, ${STYLE}`,
  },
  {
    file: "kid-jersey.png",
    size: "1024x1024",
    prompt: `Kids deep royal purple and gold sports jersey with large gold number 26, smaller children size on ghost mannequin, ${STYLE}`,
  },
  {
    file: "kid-cap.png",
    size: "1024x1024",
    prompt: `Kids black soft unstructured dad cap with gold embroidered crown logo, curved brim, smaller children size, ${STYLE}`,
  },
];

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const zai = await ZAI.create();
  let ok = 0;
  for (const task of TASKS) {
    const out = path.join(OUT_DIR, task.file);
    if (fs.existsSync(out) && fs.statSync(out).size > 20000) {
      console.log(`skip (exists): ${task.file}`);
      ok++;
      continue;
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`generating ${task.file} (attempt ${attempt})...`);
        const res = await zai.images.generations.create({
          prompt: task.prompt,
          size: task.size as never,
        });
        const b64 = res.data?.[0]?.base64;
        if (!b64) throw new Error("no image data");
        fs.writeFileSync(out, Buffer.from(b64, "base64"));
        console.log(`saved: ${task.file}`);
        ok++;
        break;
      } catch (err) {
        console.error(`fail ${task.file} attempt ${attempt}:`, (err as Error).message);
        if (attempt === 3) fs.writeFileSync(out + ".failed", String(err));
        await new Promise((r) => setTimeout(r, 1500 * attempt));
      }
    }
  }
  console.log(`DONE ${ok}/${TASKS.length}`);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
