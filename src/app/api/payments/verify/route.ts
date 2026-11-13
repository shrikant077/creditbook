import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Online payment verification is not enabled yet." },
    { status: 503 }
  );
}
