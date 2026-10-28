import { NextResponse } from "next/server";
import { clearModelCooldownForProvider } from "@/lib/services/cooldownService";

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const modelId = body?.modelId;

    if (!modelId || typeof modelId !== "string" || !modelId.trim()) {
      return NextResponse.json({ error: "modelId is required" }, { status: 400 });
    }

    const result = await clearModelCooldownForProvider(id, modelId.trim());
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error resetting model cooldown:", error);
    return NextResponse.json({ error: "Failed to reset model cooldown" }, { status: 500 });
  }
}
