import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/usageDb";

export async function GET(request) {
  try {
    const structured = new URL(request.url).searchParams.get("format") === "json";
    const logs = await getRecentLogs(200, structured);
    return NextResponse.json(logs);
  } catch (error) {
    console.error("[API ERROR] /api/usage/logs failed:", error);
    console.error("[API ERROR] Stack:", error?.stack);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
