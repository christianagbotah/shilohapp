/**
 * Notification orchestration — runs whenever an order is placed or a payment
 * is confirmed. Sends SMS (Hubtel) + email (SMTP via nodemailer) and records
 * every attempt in NotificationLog so the back office can audit delivery.
 *
 * Nothing here throws: each channel resolves to a log row.
 */
import nodemailer from "nodemailer";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/store-utils";
import { formatGhs } from "@/lib/format";
import {
  getHubtelSmsBalance,
  getHubtelSmsConfig,
  sendHubtelSms,
  smsOrderPlacedAdmin,
  smsOrderPlacedCustomer,
  smsPaymentConfirmedAdmin,
  smsPaymentConfirmedCustomer,
  smsStatusUpdateCustomer,
  type NotifiableOrderStatus,
  type NotifyOrder,
} from "@/lib/hubtel";

type Purpose =
  | "order_placed_customer"
  | "order_placed_admin"
  | "payment_confirmed_customer"
  | "payment_confirmed_admin"
  | "order_status_customer"
  | "test";

type LogInput = {
  channel: "sms" | "email";
  recipient: string;
  purpose: Purpose;
  status: "sent" | "failed" | "skipped";
  detail?: string;
  orderId?: string;
};

async function log(input: LogInput): Promise<void> {
  try {
    await db.notificationLog.create({
      data: {
        channel: input.channel,
        recipient: input.recipient,
        purpose: input.purpose,
        status: input.status,
        detail: input.detail?.slice(0, 500),
        orderId: input.orderId ?? null,
      },
    });
  } catch (err) {
    console.error("NotificationLog write failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

async function flag(key: string, fallback: boolean): Promise<boolean> {
  const v = await getSetting(key);
  if (v === null) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export type EmailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  to: string;
};

export async function getEmailConfig(): Promise<EmailConfig | null> {
  const [host, port, user, pass, secure, from, to, adminEmail] = await Promise.all([
    getSetting("smtp_host"),
    getSetting("smtp_port"),
    getSetting("smtp_user"),
    getSetting("smtp_pass"),
    getSetting("smtp_secure"),
    getSetting("notify_from_email"),
    getSetting("notify_to_email"),
    getSetting("admin_email"),
  ]);
  if (!host || !user || !pass) return null;
  const portNum = Number(port) || 587;
  return {
    host,
    port: portNum,
    // Gmail & co: 465 implies TLS-on-connect, everything else STARTTLS.
    secure: secure !== null ? secure === "1" : portNum === 465,
    user,
    pass,
    from: from || user,
    to: to || adminEmail || user,
  };
}

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

async function sendSms(
  to: string,
  content: string,
  purpose: Purpose,
  orderId?: string
): Promise<void> {
  if (!to) {
    await log({ channel: "sms", recipient: "—", purpose, status: "skipped", detail: "No recipient configured", orderId });
    return;
  }
  const config = await getHubtelSmsConfig();
  if (!config) {
    await log({ channel: "sms", recipient: to, purpose, status: "skipped", detail: "Hubtel SMS API not configured", orderId });
    return;
  }
  const result = await sendHubtelSms(to, content);
  if (result.ok) {
    await log({ channel: "sms", recipient: to, purpose, status: "sent", detail: result.detail, orderId });
  } else {
    await log({ channel: "sms", recipient: to, purpose, status: "failed", detail: result.error, orderId });
  }
}

// ---------------------------------------------------------------------------
// Email
// ---------------------------------------------------------------------------

async function sendEmail(
  subject: string,
  html: string,
  purpose: Purpose,
  orderId?: string
): Promise<void> {
  const config = await getEmailConfig();
  if (!config) {
    await log({ channel: "email", recipient: "—", purpose, status: "skipped", detail: "SMTP not configured", orderId });
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 12_000,
    });
    const info = await transporter.sendMail({
      from: config.from,
      to: config.to,
      subject,
      html,
    });
    await log({
      channel: "email",
      recipient: config.to,
      purpose,
      status: "sent",
      detail: `MessageId ${info.messageId}`,
      orderId,
    });
  } catch (err) {
    await log({
      channel: "email",
      recipient: config.to,
      purpose,
      status: "failed",
      detail: err instanceof Error ? err.message : "SMTP error",
      orderId,
    });
  }
}

// ---------------------------------------------------------------------------
// HTML email bodies
// ---------------------------------------------------------------------------

function emailShell(title: string, accent: string, body: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:24px;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e7e5e4;">
    <div style="background:${accent};padding:22px 28px;">
      <p style="margin:0;font-size:11px;letter-spacing:3px;font-weight:bold;color:#fffdf7;">WINNERS CHAPEL INTERNATIONAL</p>
      <p style="margin:6px 0 0;font-size:22px;font-weight:bold;color:#ffffff;">SHILOH 2026 — ${title}</p>
    </div>
    <div style="padding:28px;">${body}</div>
    <div style="padding:18px 28px;background:#faf9f7;border-top:1px solid #e7e5e4;font-size:12px;color:#78716c;">
      Shiloh 2026 Merch • Back Office alert • This is an automated message.
    </div>
  </div>
</body></html>`;
}

function itemsTableHtml(order: NotifyOrder): string {
  const rows = order.items
    .map(
      (i) => `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #e7e5e4;font-size:13px;">${i.quantity} × ${i.productName}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e7e5e4;font-size:13px;">${i.color} • ${i.size}</td>
      </tr>`
    )
    .join("");
  return `<table style="width:100%;border-collapse:collapse;margin:14px 0;">
    <tr style="background:#faf9f7;">
      <th style="text-align:left;padding:8px 10px;font-size:12px;color:#57534e;">ITEM</th>
      <th style="text-align:left;padding:8px 10px;font-size:12px;color:#57534e;">DETAILS</th>
    </tr>${rows}</table>`;
}

// ---------------------------------------------------------------------------
// Public orchestration API
// ---------------------------------------------------------------------------

/** Called right after a new order is created (via next/server after()). */
export async function notifyOrderPlaced(order: NotifyOrder): Promise<void> {
  const [adminPhone, customerSmsOn, adminSmsOn, adminEmailOn] = await Promise.all([
    getSetting("admin_phone"),
    flag("notify_customer_sms", true),
    flag("notify_admin_sms", true),
    flag("notify_admin_email", true),
  ]);

  const jobs: Array<Promise<void>> = [];

  if (customerSmsOn) {
    jobs.push(
      sendSms(order.phone, smsOrderPlacedCustomer(order), "order_placed_customer", order.id)
    );
  }
  if (adminSmsOn && adminPhone) {
    jobs.push(sendSms(adminPhone, smsOrderPlacedAdmin(order), "order_placed_admin", order.id));
  } else if (adminSmsOn) {
    jobs.push(
      log({
        channel: "sms",
        recipient: "—",
        purpose: "order_placed_admin",
        status: "skipped",
        detail: "Admin phone not set",
        orderId: order.id,
      })
    );
  }
  if (adminEmailOn) {
    jobs.push(
      sendEmail(
        `New order ${order.code} — ${formatGhs(order.total)}`,
        emailShell(
          "NEW ORDER",
          "#b8860b",
          `<p style="font-size:14px;margin:0;">A new order has just been placed on the Shiloh merch store.</p>
           ${itemsTableHtml(order)}
           <p style="font-size:14px;"><strong>Order code:</strong> ${order.code} &nbsp;•&nbsp; <strong>Total:</strong> ${formatGhs(order.total)}</p>
           <p style="font-size:14px;"><strong>Customer:</strong> ${order.fullName}<br/>
           <strong>Phone:</strong> ${order.phone}<br/>
           <strong>Address:</strong> see back office</p>
           <p style="font-size:13px;color:#57534e;">Open the Back Office to review and process this order.</p>`
        ),
        "order_placed_admin",
        order.id
      )
    );
  }

  await Promise.allSettled(jobs);
}

/** Called when the back office moves an order to contacted / fulfilled / cancelled. */
export async function notifyOrderStatusChanged(
  order: NotifyOrder,
  status: NotifiableOrderStatus
): Promise<void> {
  const statusSmsOn = await flag("notify_customer_status_sms", true);
  if (!statusSmsOn) return;

  await sendSms(
    order.phone,
    smsStatusUpdateCustomer(order, status),
    "order_status_customer",
    order.id
  );
}

/** Called when a Hubtel payment is verified (callback or polling). */
export async function notifyPaymentConfirmed(order: NotifyOrder): Promise<void> {
  const [adminPhone, customerSmsOn, adminSmsOn, adminEmailOn] = await Promise.all([
    getSetting("admin_phone"),
    flag("notify_customer_sms", true),
    flag("notify_admin_sms", true),
    flag("notify_admin_email", true),
  ]);

  const jobs: Array<Promise<void>> = [];

  if (customerSmsOn) {
    jobs.push(
      sendSms(
        order.phone,
        smsPaymentConfirmedCustomer(order),
        "payment_confirmed_customer",
        order.id
      )
    );
  }
  if (adminSmsOn && adminPhone) {
    jobs.push(
      sendSms(adminPhone, smsPaymentConfirmedAdmin(order), "payment_confirmed_admin", order.id)
    );
  }
  if (adminEmailOn) {
    jobs.push(
      sendEmail(
        `Payment received — ${order.code} (${formatGhs(order.total)})`,
        emailShell(
          "PAYMENT CONFIRMED",
          "#15803d",
          `<p style="font-size:14px;margin:0;">Hubtel payment for order <strong>${order.code}</strong> was verified.</p>
           ${itemsTableHtml(order)}
           <p style="font-size:14px;"><strong>Amount:</strong> ${formatGhs(order.total)} &nbsp;•&nbsp; <strong>Customer:</strong> ${order.fullName} (${order.phone})</p>
           <p style="font-size:13px;color:#57534e;">The order is now paid — arrange delivery from the Back Office.</p>`
        ),
        "payment_confirmed_admin",
        order.id
      )
    );
  }

  await Promise.allSettled(jobs);
}

// ---------------------------------------------------------------------------
// Tests (from the Back Office settings tab)
// ---------------------------------------------------------------------------

export type TestSmsOutcome = {
  status: "sent" | "failed" | "skipped";
  /** Human-readable detail (provider response + SMS balance when known). */
  detail?: string;
};

export async function sendTestSms(): Promise<TestSmsOutcome> {
  const adminPhone = await getSetting("admin_phone");
  if (!adminPhone) {
    await log({ channel: "sms", recipient: "—", purpose: "test", status: "skipped", detail: "Admin phone not set" });
    return { status: "skipped", detail: "Admin phone is not set in Settings." };
  }
  const config = await getHubtelSmsConfig();
  if (!config) {
    await log({ channel: "sms", recipient: adminPhone, purpose: "test", status: "skipped", detail: "Hubtel SMS API not configured" });
    return { status: "skipped", detail: "Hubtel SMS API key / secret not configured." };
  }
  // Report the account balance alongside the test so the admin can top up
  // before it runs dry (mirrors the balance check in the PHP integration).
  const [result, balance] = await Promise.all([
    sendHubtelSms(
      adminPhone,
      "Shiloh 2026 Back Office: this is a test SMS. Your SMS alerts are working!"
    ),
    getHubtelSmsBalance(),
  ]);
  const balanceNote =
    balance && balance.balance !== null
      ? ` Hubtel SMS balance: GHS ${balance.balance.toFixed(2)}.`
      : "";
  if (result.ok) {
    await log({
      channel: "sms",
      recipient: adminPhone,
      purpose: "test",
      status: "sent",
      detail: `${result.detail}.${balanceNote}`.trim(),
    });
    return {
      status: "sent",
      detail: `Test SMS sent to ${adminPhone}.${balanceNote}`.trim(),
    };
  }
  await log({
    channel: "sms",
    recipient: adminPhone,
    purpose: "test",
    status: "failed",
    detail: `${result.error}.${balanceNote}`.trim(),
  });
  return { status: "failed", detail: `${result.error}.${balanceNote}`.trim() };
}

export async function sendTestEmail(): Promise<"sent" | "failed" | "skipped"> {
  const config = await getEmailConfig();
  if (!config) {
    await log({ channel: "email", recipient: "—", purpose: "test", status: "skipped", detail: "SMTP not configured" });
    return "skipped";
  }
  try {
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: config.user, pass: config.pass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 12_000,
    });
    const info = await transporter.sendMail({
      from: config.from,
      to: config.to,
      subject: "Shiloh 2026 Back Office — test email",
      html: emailShell(
        "TEST EMAIL",
        "#b8860b",
        `<p style="font-size:14px;">This is a test message from your Shiloh merch Back Office. Your email alerts are working!</p>`
      ),
    });
    await log({ channel: "email", recipient: config.to, purpose: "test", status: "sent", detail: `MessageId ${info.messageId}` });
    return "sent";
  } catch (err) {
    await log({
      channel: "email",
      recipient: config.to,
      purpose: "test",
      status: "failed",
      detail: err instanceof Error ? err.message : "SMTP error",
    });
    return "failed";
  }
}
