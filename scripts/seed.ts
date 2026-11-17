/**
 * Seed the Shiloh merch catalogue + default store settings.
 * Run: bun scripts/seed.ts
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const db = new PrismaClient();

const ADULT_SIZES = ["S", "M", "L", "XL", "XXL"];
const KID_SIZES = ["2-3y", "4-5y", "6-7y", "8-9y", "10-11y", "12-13y"];
const CAP_SIZES = ["S/M", "L/XL", "One Size"];
const CAP_STYLES = ["Soft", "Hard"];

const C = {
  black: { name: "Black", hex: "#1c1a1e" },
  white: { name: "White", hex: "#f2f0ea" },
  gold: { name: "Gold", hex: "#d4a437" },
  purple: { name: "Purple", hex: "#6b3fa0" },
  crimson: { name: "Crimson", hex: "#9e1b30" },
  grey: { name: "Grey", hex: "#8d8a90" },
  green: { name: "Forest", hex: "#1f4d33" },
};

const products = [
  {
    type: "tshirt",
    ageGroup: "adult",
    name: "Shiloh Classic Tee",
    tagline: "Heavyweight cotton tee with the Shiloh 2026 gold crest",
    price: 80,
    image: "/products/adult-tshirt.png",
    colors: [C.black, C.white, C.gold, C.purple, C.crimson, C.green],
    sizes: ADULT_SIZES,
    badge: "Best Seller",
    sortOrder: 1,
  },
  {
    type: "lacoste",
    ageGroup: "adult",
    name: "Shiloh Lacoste",
    tagline: "Premium pique polo with embroidered gold crown",
    price: 120,
    image: "/products/adult-lacoste.png",
    colors: [C.black, C.white, C.purple, C.crimson, C.grey],
    sizes: ADULT_SIZES,
    badge: "Premium",
    sortOrder: 2,
  },
  {
    type: "jersey",
    ageGroup: "adult",
    name: "Shiloh Convocation Jersey",
    tagline: "Purple & gold athletic jersey, number 26",
    price: 180,
    image: "/products/adult-jersey.png",
    colors: [C.purple, C.black, C.white],
    sizes: ADULT_SIZES,
    badge: "New",
    sortOrder: 3,
  },
  {
    type: "cap",
    ageGroup: "adult",
    name: "Shiloh Cap",
    tagline: "Structured or soft cap with gold embroidery",
    price: 60,
    image: "/products/adult-cap.png",
    colors: [C.black, C.white, C.gold, C.purple],
    sizes: CAP_SIZES,
    capStyles: CAP_STYLES,
    badge: null,
    sortOrder: 4,
  },
  {
    type: "tshirt",
    ageGroup: "kid",
    name: "Shiloh Kids Tee",
    tagline: "Soft cotton tee with the Shiloh Kids graphic",
    price: 60,
    image: "/products/kid-tshirt.png",
    colors: [C.black, C.white, C.gold, C.purple, C.crimson],
    sizes: KID_SIZES,
    badge: null,
    sortOrder: 5,
  },
  {
    type: "lacoste",
    ageGroup: "kid",
    name: "Shiloh Kids Lacoste",
    tagline: "Kids pique polo with the gold crown logo",
    price: 90,
    image: "/products/kid-lacoste.png",
    colors: [C.black, C.white, C.purple, C.crimson],
    sizes: KID_SIZES,
    badge: null,
    sortOrder: 6,
  },
  {
    type: "jersey",
    ageGroup: "kid",
    name: "Shiloh Kids Jersey",
    tagline: "Kids purple & gold athletic jersey",
    price: 130,
    image: "/products/kid-jersey.png",
    colors: [C.purple, C.black],
    sizes: KID_SIZES,
    badge: null,
    sortOrder: 7,
  },
  {
    type: "cap",
    ageGroup: "kid",
    name: "Shiloh Kids Cap",
    tagline: "Soft or hard cap, sized for young champions",
    price: 50,
    image: "/products/kid-cap.png",
    colors: [C.black, C.white, C.gold],
    sizes: ["S/M", "L/XL"],
    capStyles: CAP_STYLES,
    badge: null,
    sortOrder: 8,
  },
];

async function main() {
  // Products — upsert by name so re-running is safe
  for (const p of products) {
    const existing = await db.product.findFirst({ where: { name: p.name } });
    const data = {
      type: p.type,
      ageGroup: p.ageGroup,
      name: p.name,
      tagline: p.tagline,
      price: p.price,
      image: p.image,
      colors: JSON.stringify(p.colors),
      sizes: JSON.stringify(p.sizes),
      capStyles: p.capStyles ? JSON.stringify(p.capStyles) : null,
      badge: p.badge ?? null,
      sortOrder: p.sortOrder,
      active: true,
    };
    if (existing) {
      await db.product.update({ where: { id: existing.id }, data });
    } else {
      await db.product.create({ data });
    }
    console.log(`seeded product: ${p.name}`);
  }

  // Settings
  const hash = (pw: string) =>
    crypto.createHash("sha256").update(pw + "|shiloh-merch-salt").digest("hex");

  const settings: Record<string, string> = {
    momo_number: "0555 123 456", // placeholder — change in Back Office
    momo_name: "Shiloh Merch GH",
    momo_network: "MTN MoMo",
    admin_password: hash("shiloh2026"),
    announcement: "Order early — every order is delivered before Dec 8, Shiloh week.",
    // Event branding — editable every year from the Back Office
    shiloh_year: "2026",
    shiloh_tagline: "Far Above",
    shiloh_dates: "December 8–13",
    shiloh_start: "2026-12-08",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log("seeded settings");
  const count = await db.product.count();
  console.log(`DONE — ${count} products in catalogue`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
