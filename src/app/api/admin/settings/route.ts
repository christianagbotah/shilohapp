import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest, hashPassword } from "@/lib/admin-auth";
import { getSetting } from "@/lib/store-utils";
import { encryptSettingSecret, secretEncryptionReady } from "@/lib/secret-settings";

export const dynamic = "force-dynamic";

/** Secrets are never returned — only whether they are configured. */
const settingsSchema = z.object({
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
  newPassword: z.string().min(12).max(100).optional(),
  // Hubtel online checkout
  hubtelClientId: z.string().trim().max(120).optional(),
  hubtelClientSecret: z.string().trim().max(120).nullable().optional(),
  hubtelMerchantNumber: z.string().trim().max(60).optional(),
  hubtelMerchantName: z.string().trim().max(60).optional(),
  siteUrl: z.string().trim().max(200).refine((value) => {
    if (!value) return true;
    try {
      const parsed = new URL(value);
      return parsed.protocol === "https:" && parsed.pathname === "/" &&
        !parsed.username && !parsed.password && !parsed.search && !parsed.hash;
    } catch { return false; }
  }, "Enter a full HTTPS website origin with no extra path").optional(),
  // Hubtel SMS alerts
  smsClientId: z.string().trim().max(120).optional(),
  smsClientSecret: z.string().trim().max(120).nullable().optional(),
  smsSender: z.string().trim().max(20).optional(),
  adminPhone: z.string().trim().max(20).optional(),
  adminEmail: z.string().trim().max(120).optional(),
  // Toggles
  notifyCustomerSms: z.boolean().optional(),
  notifyStatusSms: z.boolean().optional(),
  notifyAdminSms: z.boolean().optional(),
  notifyAdminEmail: z.boolean().optional(),
  // SMTP email alerts
  smtpHost: z.string().trim().max(120).optional(),
  smtpPort: z.string().trim().max(6).optional(),
  smtpUser: z.string().trim().max(120).optional(),
  smtpPass: z.string().trim().max(200).nullable().optional(),
  smtpSecure: z.boolean().optional(),
  smtpFromEmail: z.string().trim().max(120).optional(),
  smtpToEmail: z.string().trim().max(120).optional(),
});

const bool = (v: string | null, fallback: boolean) => {
  if (v === null) return fallback;
  return v === "1";
};

export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const keys = [
      "announcement",
      "shiloh_year",
      "shiloh_tagline",
      "shiloh_dates",
      "shiloh_start",
      "hubtel_client_id",
      "hubtel_client_secret",
      "hubtel_merchant_number",
      "hubtel_merchant_name",
      "site_url",
      "sms_client_id",
      "sms_client_secret",
      "sms_sender",
      "admin_phone",
      "admin_email",
      "notify_customer_sms",
      "notify_customer_status_sms",
      "notify_admin_sms",
      "notify_admin_email",
      "smtp_host",
      "smtp_port",
      "smtp_user",
      "smtp_pass",
      "smtp_secure",
      "notify_from_email",
      "notify_to_email",
    ];
    const rows = await db.setting.findMany({ where: { key: { in: keys } } });
    const map = new Map(rows.map((r) => [r.key, r.value]));

    return NextResponse.json({
      announcement: map.get("announcement") ?? "",
      shilohYear: map.get("shiloh_year") ?? "2026",
      shilohTagline: map.get("shiloh_tagline") ?? "Far Above",
      shilohDates: map.get("shiloh_dates") ?? "December 8–13",
      shilohStart: map.get("shiloh_start") ?? "2026-12-08",
      paymentTestEnabled: process.env.SHILOH_LIVE_PAYMENT_TEST_ENABLED === "true",
      hubtel: {
        clientId: map.get("hubtel_client_id") ?? "",
        secretSet: Boolean(map.get("hubtel_client_secret")),
        merchantNumber: map.get("hubtel_merchant_number") ?? "",
        merchantName: map.get("hubtel_merchant_name") ?? "",
        siteUrl: map.get("site_url") ?? "",
        active: Boolean(
          map.get("hubtel_client_id") &&
            map.get("hubtel_client_secret") &&
            map.get("hubtel_merchant_number") &&
            (map.get("site_url") || process.env.NEXT_PUBLIC_SITE_URL)
        ),
      },
      sms: {
        clientId: map.get("sms_client_id") ?? "",
        secretSet: Boolean(map.get("sms_client_secret")),
        sender: map.get("sms_sender") ?? "",
        adminPhone: map.get("admin_phone") ?? "",
        adminEmail: map.get("admin_email") ?? "",
        notifyCustomer: bool(map.get("notify_customer_sms") ?? null, true),
        notifyStatus: bool(map.get("notify_customer_status_sms") ?? null, true),
        notifyAdmin: bool(map.get("notify_admin_sms") ?? null, true),
      },
      email: {
        host: map.get("smtp_host") ?? "",
        port: map.get("smtp_port") ?? "587",
        user: map.get("smtp_user") ?? "",
        passwordSet: Boolean(map.get("smtp_pass")),
        secure: bool(map.get("smtp_secure") ?? null, false),
        from: map.get("notify_from_email") ?? "",
        to: map.get("notify_to_email") ?? "",
        notifyAdmin: bool(map.get("notify_admin_email") ?? null, true),
      },
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
    const d = parsed.data;
    if ((d.hubtelClientSecret || d.smsClientSecret || d.smtpPass) && !secretEncryptionReady()) {
      return NextResponse.json({
        error: "Credential encryption is not configured on the server. Set SHILOH_SETTINGS_ENCRYPTION_KEY before saving API secrets.",
      }, { status: 503 });
    }

    const updates: Array<{ key: string; value: string }> = [];
    const put = (key: string, value: string) => updates.push({ key, value });

    if (d.announcement !== undefined) put("announcement", d.announcement);
    if (d.shilohYear !== undefined) put("shiloh_year", d.shilohYear);
    if (d.shilohTagline !== undefined) put("shiloh_tagline", d.shilohTagline);
    if (d.shilohDates !== undefined) put("shiloh_dates", d.shilohDates);
    if (d.shilohStart !== undefined) put("shiloh_start", d.shilohStart);
    if (d.newPassword !== undefined) put("admin_password", hashPassword(d.newPassword));

    // Hubtel payment
    if (d.hubtelClientId !== undefined) put("hubtel_client_id", d.hubtelClientId);
    if (d.hubtelClientSecret !== undefined) {
      put("hubtel_client_secret", encryptSettingSecret(d.hubtelClientSecret ?? ""));
    }
    if (d.hubtelMerchantNumber !== undefined) put("hubtel_merchant_number", d.hubtelMerchantNumber);
    if (d.hubtelMerchantName !== undefined) put("hubtel_merchant_name", d.hubtelMerchantName);
    if (d.siteUrl !== undefined) put("site_url", d.siteUrl);

    // SMS
    if (d.smsClientId !== undefined) put("sms_client_id", d.smsClientId);
    if (d.smsClientSecret !== undefined) put("sms_client_secret", encryptSettingSecret(d.smsClientSecret ?? ""));
    if (d.smsSender !== undefined) put("sms_sender", d.smsSender);
    if (d.adminPhone !== undefined) put("admin_phone", d.adminPhone);
    if (d.adminEmail !== undefined) put("admin_email", d.adminEmail);

    // Toggles
    if (d.notifyCustomerSms !== undefined)
      put("notify_customer_sms", d.notifyCustomerSms ? "1" : "0");
    if (d.notifyStatusSms !== undefined)
      put("notify_customer_status_sms", d.notifyStatusSms ? "1" : "0");
    if (d.notifyAdminSms !== undefined) put("notify_admin_sms", d.notifyAdminSms ? "1" : "0");
    if (d.notifyAdminEmail !== undefined)
      put("notify_admin_email", d.notifyAdminEmail ? "1" : "0");

    // SMTP
    if (d.smtpHost !== undefined) put("smtp_host", d.smtpHost);
    if (d.smtpPort !== undefined) put("smtp_port", d.smtpPort);
    if (d.smtpUser !== undefined) put("smtp_user", d.smtpUser);
    if (d.smtpPass !== undefined) put("smtp_pass", encryptSettingSecret(d.smtpPass ?? ""));
    if (d.smtpSecure !== undefined) put("smtp_secure", d.smtpSecure ? "1" : "0");
    if (d.smtpFromEmail !== undefined) put("notify_from_email", d.smtpFromEmail);
    if (d.smtpToEmail !== undefined) put("notify_to_email", d.smtpToEmail);

    for (const u of updates) {
      await db.setting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value },
      });
    }

    if (d.newPassword !== undefined) await db.adminSession.deleteMany();
    return NextResponse.json({ ok: true, passwordChanged: d.newPassword !== undefined });
  } catch (err) {
    console.error("PATCH /api/admin/settings failed:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}
