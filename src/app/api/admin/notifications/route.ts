import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdminRequest } from "@/lib/admin-auth";
import { sendTestEmail, sendTestSms } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** Recent SMS/email delivery log for the Back Office "Alerts" tab. */
export async function GET(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const logs = await db.notificationLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { order: { select: { code: true } } },
    });
    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        channel: l.channel,
        recipient: l.recipient,
        purpose: l.purpose,
        status: l.status,
        detail: l.detail,
        orderCode: l.order?.code ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("GET /api/admin/notifications failed:", err);
    return NextResponse.json({ error: "Failed to load notification log" }, { status: 500 });
  }
}

const testSchema = z.object({ channel: z.enum(["sms", "email"]) });

/** Send a test SMS / test email to the configured admin contact. */
export async function POST(req: NextRequest) {
  if (!(await isAdminRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const parsed = testSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid channel" }, { status: 400 });
    }
    const result =
      parsed.data.channel === "sms" ? await sendTestSms() : await sendTestEmail();

    const message =
      result === "sent"
        ? parsed.data.channel === "sms"
          ? "Test SMS sent to the admin phone."
          : "Test email sent."
        : result === "skipped"
          ? "Skipped — channel is not fully configured yet (check the settings below)."
          : "Failed — see the newest entry in the log for the provider error.";

    return NextResponse.json({ result, message });
  } catch (err) {
    console.error("POST /api/admin/notifications failed:", err);
    return NextResponse.json({ error: "Test send failed" }, { status: 500 });
  }
}
