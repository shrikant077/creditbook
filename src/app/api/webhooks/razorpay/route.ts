import { NextResponse } from "next/server";

// This placeholder is intentionally inactive. Configure Razorpay webhooks only
// after the approved per-store merchant integration has been implemented.
export async function POST() {
  return NextResponse.json(
    { error: "Razorpay webhooks are not configured for this deployment." },
    { status: 503 }
  );
}
