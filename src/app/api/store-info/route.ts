import { NextResponse } from "next/server";
import { getSetting } from "@/lib/store-utils";
import { STORE_INFO_DEFAULTS } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      momoNumber,
      momoName,
      momoNetwork,
      announcement,
      shilohYear,
      shilohTagline,
      shilohDates,
      shilohStart,
      hubtelClientId,
      hubtelClientSecret,
    ] = await Promise.all([
      getSetting("momo_number"),
      getSetting("momo_name"),
      getSetting("momo_network"),
      getSetting("announcement"),
      getSetting("shiloh_year"),
      getSetting("shiloh_tagline"),
      getSetting("shiloh_dates"),
      getSetting("shiloh_start"),
      getSetting("hubtel_client_id"),
      getSetting("hubtel_client_secret"),
    ]);
    return NextResponse.json({
      momoNumber: momoNumber ?? "",
      momoName: momoName ?? "",
      momoNetwork: momoNetwork ?? "MTN MoMo",
      announcement: announcement ?? "",
      shilohYear: shilohYear ?? STORE_INFO_DEFAULTS.shilohYear,
      shilohTagline: shilohTagline ?? STORE_INFO_DEFAULTS.shilohTagline,
      shilohDates: shilohDates ?? STORE_INFO_DEFAULTS.shilohDates,
      shilohStart: shilohStart ?? STORE_INFO_DEFAULTS.shilohStart,
      /** True when the admin has activated Hubtel online checkout. */
      hubtelActive: Boolean(hubtelClientId && hubtelClientSecret),
    });
  } catch (err) {
    console.error("GET /api/store-info failed:", err);
    return NextResponse.json({ error: "Failed to load store info" }, { status: 500 });
  }
}
