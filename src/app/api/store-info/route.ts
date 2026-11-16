import { NextResponse } from "next/server";
import { getSetting } from "@/lib/store-utils";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [momoNumber, momoName, momoNetwork, announcement] = await Promise.all([
      getSetting("momo_number"),
      getSetting("momo_name"),
      getSetting("momo_network"),
      getSetting("announcement"),
    ]);
    return NextResponse.json({
      momoNumber: momoNumber ?? "",
      momoName: momoName ?? "",
      momoNetwork: momoNetwork ?? "MTN MoMo",
      announcement: announcement ?? "",
    });
  } catch (err) {
    console.error("GET /api/store-info failed:", err);
    return NextResponse.json({ error: "Failed to load store info" }, { status: 500 });
  }
}
