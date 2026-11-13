import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyWebhookSignature } from "@/lib/razorpay";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // Read the raw body first. Re-serialising parsed JSON changes the bytes used for HMAC verification.
  const rawBody = await request.text();
  if (rawBody.length > 1_000_000) return NextResponse.json({ error: "Webhook payload too large." }, { status: 413 });
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  if (!signature || !eventId) return NextResponse.json({ error: "Missing webhook signature or event id." }, { status: 400 });
  try {
    if (!verifyWebhookSignature(rawBody, signature)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
    const payload = JSON.parse(rawBody) as { event?: string };
    if (!payload.event) return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
    const admin = createAdminClient();
    const { error } = await admin.rpc("process_razorpay_webhook", {
      p_event_id: eventId,
      p_event_type: payload.event,
      p_payload: payload
    });
    if (error) throw error;
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("razorpay webhook failed", error);
    // Non-2xx tells Razorpay delivery failed so it can retry.
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
