import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Online payments are not enabled yet. Each store must complete its own payment-account onboarding first." },
    { status: 503 }
  );
}
