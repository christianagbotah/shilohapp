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
  newPassword: z.string().min(6).max(60).optional(),
});

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const [momoNumber, momoName, announcement] = await Promise.all([
      getSetting("momo_number"),
      getSetting("momo_name"),
      getSetting("announcement"),
    ]);
    return NextResponse.json({
      momoNumber: momoNumber ?? "",
      momoName: momoName ?? "",
      announcement: announcement ?? "",
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
    const { momoNumber, momoName, announcement, newPassword } = parsed.data;

    const updates: Array<{ key: string; value: string }> = [];
    if (momoNumber !== undefined) updates.push({ key: "momo_number", value: momoNumber });
    if (momoName !== undefined) updates.push({ key: "momo_name", value: momoName });
    if (announcement !== undefined) updates.push({ key: "announcement", value: announcement });
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
