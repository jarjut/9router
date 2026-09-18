import { NextResponse } from "next/server";
import { getRecentLogs } from "@/lib/usageDb";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const logs = await getRecentLogs(200);
    return NextResponse.json(logs, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}
