import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { loadSiteContent } from "@/lib/site-content-server";
import { CONTENT_KEYS } from "@/lib/site-content";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Validation — a saved section is always the FULL section (complete fields),
// so the storefront can trust its shape.
// ---------------------------------------------------------------------------

const str = (max: number) => z.string().trim().max(max);

const heroSchema = z.object({
  intro: str(600),
  ctaPrimary: str(60),
  ctaSecondary: str(60),
  flyerImage: str(300),
  badgeTitle: str(80),
  badgeSubtitle: str(80),
  trust: z.array(str(80)).max(6),
});

const marqueeSchema = z.object({
  extras: z.array(str(60)).min(1).max(12),
});

const headingSchema = z.object({
  eyebrow: str(60),
  title: str(80),
  subtitle: str(400),
});

const howSchema = headingSchema.extend({
  steps: z.array(z.object({ title: str(80), body: str(600) })).min(1).max(6),
});

const paymentSchema = z.object({
  eyebrow: str(60),
  title: str(80),
  titleAccent: str(80),
  subtitle: str(600),
  features: z.array(z.object({ title: str(80), body: str(400) })).min(1).max(6),
  steps: z.array(str(400)).min(1).max(8),
  methods: z.array(str(30)).min(1).max(10),
  buttonLabel: str(40),
});

const faqSchema = headingSchema.extend({
  items: z.array(z.object({ q: str(200), a: str(1200) })).min(1).max(20),
});

const ctaSchema = z.object({
  title: str(80),
  titleAccent: str(80),
  subtitle: str(400),
  buttonLabel: str(40),
});

const footerSchema = z.object({
  about: str(800),
  location: str(120),
  copyright: str(200),
});

const lookbookSchema = headingSchema.extend({
  slides: z
    .array(z.object({ image: str(300), title: str(100), description: str(300) }))
    .min(1)
    .max(8),
});

const sectionSchemas = {
  hero: heroSchema,
  marquee: marqueeSchema,
  shop: headingSchema,
  how: howSchema,
  payment: paymentSchema,
  faq: faqSchema,
  cta: ctaSchema,
  footer: footerSchema,
  lookbook: lookbookSchema,
} as const;

/** Load all content sections merged over the defaults. */

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ content: await loadSiteContent() });
  } catch (err) {
    console.error("GET /api/admin/content failed:", err);
    return NextResponse.json({ error: "Failed to load site content" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { section?: string; data?: unknown };
    const section = body.section as keyof typeof sectionSchemas | undefined;
    if (!section || !(section in sectionSchemas)) {
      return NextResponse.json({ error: "Unknown section" }, { status: 400 });
    }

    const schema = sectionSchemas[section];
    const parsed = schema.safeParse(body.data);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid content" },
        { status: 400 }
      );
    }

    // The admin editor always submits complete sections, so the saved copy
    // wins over the defaults. Defaults still cover any missing field.
    await db.setting.upsert({
      where: { key: CONTENT_KEYS[section] },
      update: { value: JSON.stringify(parsed.data) },
      create: { key: CONTENT_KEYS[section], value: JSON.stringify(parsed.data) },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PUT /api/admin/content failed:", err);
    return NextResponse.json({ error: "Failed to save site content" }, { status: 500 });
  }
}
