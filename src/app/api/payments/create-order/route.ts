import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpay } from "@/lib/razorpay";

export const runtime = "nodejs";
const bodySchema = z.object({ customerId: z.string().uuid(), amountPaise: z.number().int().min(100).max(100_000_000_000) });

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return NextResponse.json({ error: "Please sign in to pay." }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });

    const { data, error } = await supabase.rpc("reserve_customer_payment", {
      p_customer_id: parsed.data.customerId,
      p_amount_paise: parsed.data.amountPaise
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const reservation = Array.isArray(data) ? data[0] : data;
    if (!reservation?.payment_id || !reservation.amount_paise) {
      return NextResponse.json({ error: "Could not reserve this payment." }, { status: 409 });
    }

    let orderId: string | null = reservation.razorpay_order_id ?? null;
    if (!orderId) {
      const razorpay = getRazorpay();
      const order = await razorpay.orders.create({
        amount: Number(reservation.amount_paise),
        currency: "INR",
        receipt: `cb_${String(reservation.payment_id).replaceAll("-", "").slice(0, 32)}`,
        notes: { payment_record_id: String(reservation.payment_id), customer_id: parsed.data.customerId }
      });
      orderId = order.id;
      const admin = createAdminClient();
      const { error: updateError } = await admin.from("payments")
        .update({ razorpay_order_id: orderId })
        .eq("id", reservation.payment_id)
        .eq("status", "pending");
      if (updateError) throw updateError;
    }

    return NextResponse.json({
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId,
      amountPaise: Number(reservation.amount_paise),
      currency: "INR"
    });
  } catch (error) {
    console.error("create-order failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create payment order." }, { status: 500 });
  }
}
