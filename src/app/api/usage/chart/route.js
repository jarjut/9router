import { NextResponse } from "next/server";
import { getChartData } from "@/lib/usageDb";
import { readUsageTimeOptions } from "../timeOptions.js";

const VALID_PERIODS = new Set(["today", "24h", "7d", "30d", "60d", "all"]);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";

    if (!VALID_PERIODS.has(period)) {
      return NextResponse.json({ error: "Invalid period" }, { status: 400 });
    }

    const options = readUsageTimeOptions(searchParams, period);
    if (!options) return NextResponse.json({ error: "Invalid time zone or date" }, { status: 400 });

    const data = await getChartData(period, options);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[API] Failed to get chart data:", error);
    return NextResponse.json({ error: "Failed to fetch chart data" }, { status: 500 });
  }
}
