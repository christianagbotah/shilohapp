import { NextResponse } from "next/server";
import { getSetting } from "@/lib/store-utils";
import { toInternationalGhPhone } from "@/lib/hubtel";
import { loadSiteContent } from "@/lib/site-content-server";
import { STORE_INFO_DEFAULTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      announcement,
      shilohYear,
      shilohTagline,
      shilohDates,
      shilohStart,
      hubtelClientId,
      hubtelClientSecret,
      hubtelMerchantNumber,
      siteUrl,
      adminPhone,
    ] = await Promise.all([
      getSetting("announcement"),
      getSetting("shiloh_year"),
      getSetting("shiloh_tagline"),
      getSetting("shiloh_dates"),
      getSetting("shiloh_start"),
      getSetting("hubtel_client_id"),
      getSetting("hubtel_client_secret"),
      getSetting("hubtel_merchant_number"),
      getSetting("site_url"),
      getSetting("admin_phone"),
    ]);
    const content = await loadSiteContent();
    return NextResponse.json({
      announcement: announcement ?? "",
      shilohYear: shilohYear ?? STORE_INFO_DEFAULTS.shilohYear,
      shilohTagline: shilohTagline ?? STORE_INFO_DEFAULTS.shilohTagline,
      shilohDates: shilohDates ?? STORE_INFO_DEFAULTS.shilohDates,
      shilohStart: shilohStart ?? STORE_INFO_DEFAULTS.shilohStart,
      /** True when the admin has activated Hubtel online checkout. */
      hubtelActive: Boolean(hubtelClientId && hubtelClientSecret && hubtelMerchantNumber && (siteUrl || process.env.NEXT_PUBLIC_SITE_URL)),
      /** Team contact number in international format for the WhatsApp
       *  click-to-chat button ("" when admin_phone is not configured). */
      supportPhone: adminPhone ? toInternationalGhPhone(adminPhone).replace("+", "") : "",
      /** Back-office editable marketing copy (merged over defaults). */
      content,
    });
  } catch (err) {
    console.error("GET /api/store-info failed:", err);
    return NextResponse.json({ error: "Failed to load store info" }, { status: 500 });
  }
}
