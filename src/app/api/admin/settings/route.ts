import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest, hashPassword } from "@/lib/admin-auth";
import { getSetting } from "@/lib/store-utils";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  momoNumber: z.string().trim().min(4).max(25).optional(),
  momoName: z.string().trim().min(2).max(60).optional(),
  announcement: z.string().trim().max(160).optional(),
  shilohYear: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "Year must be 4 digits")
    .optional(),
  shilohTagline: z.string().trim().min(2).max(60).optional(),
  shilohDates: z.string().trim().min(3).max(60).optional(),
  shilohStart: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD")
    .optional(),
  newPassword: z.string().min(6).max(60).optional(),
});

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [
      momoNumber,
      momoName,
      announcement,
      shilohYear,
      shilohTagline,
      shilohDates,
      shilohStart,
    ] = await Promise.all([
      getSetting("momo_number"),
      getSetting("momo_name"),
      getSetting("announcement"),
      getSetting("shiloh_year"),
      getSetting("shiloh_tagline"),
      getSetting("shiloh_dates"),
      getSetting("shiloh_start"),
    ]);
    return NextResponse.json({
      momoNumber: momoNumber ?? "",
      momoName: momoName ?? "",
      announcement: announcement ?? "",
      shilohYear: shilohYear ?? "2026",
      shilohTagline: shilohTagline ?? "Far Above",
      shilohDates: shilohDates ?? "December 8–13",
      shilohStart: shilohStart ?? "2026-12-08",
    });
  } catch (err) {
    console.error("GET /api/admin/settings failed:", err);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const parsed = settingsSchema.safeParse(await req.json());
    if (!parsed.success || Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    const {
      momoNumber,
      momoName,
      announcement,
      shilohYear,
      shilohTagline,
      shilohDates,
      shilohStart,
      newPassword,
    } = parsed.data;

    const updates: Array<{ key: string; value: string }> = [];
    if (momoNumber !== undefined) updates.push({ key: "momo_number", value: momoNumber });
    if (momoName !== undefined) updates.push({ key: "momo_name", value: momoName });
    if (announcement !== undefined) updates.push({ key: "announcement", value: announcement });
    if (shilohYear !== undefined) updates.push({ key: "shiloh_year", value: shilohYear });
    if (shilohTagline !== undefined) updates.push({ key: "shiloh_tagline", value: shilohTagline });
    if (shilohDates !== undefined) updates.push({ key: "shiloh_dates", value: shilohDates });
    if (shilohStart !== undefined) updates.push({ key: "shiloh_start", value: shilohStart });
    if (newPassword !== undefined) {
      updates.push({ key: "admin_password", value: hashPassword(newPassword) });
    }

    for (const u of updates) {
      await db.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      });
    }

    return NextResponse.json({ ok: true, passwordChanged: newPassword !== undefined });
  } catch (err) {
    console.error("PATCH /api/admin/settings failed:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
