import { NextRequest, NextResponse } from "next/server";
import { validateSignature } from "@line/bot-sdk";
import type { WebhookRequestBody } from "@line/bot-sdk";
import { handleLineEvent } from "@/lib/line";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("x-line-signature") ?? "";

  const isValid = validateSignature(
    body,
    process.env.LINE_CHANNEL_SECRET!,
    signature
  );

  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { events } = JSON.parse(body) as WebhookRequestBody;

  // 並行處理所有 events（通常只有一個）
  await Promise.all(events.map(handleLineEvent));

  return NextResponse.json({ ok: true });
}
