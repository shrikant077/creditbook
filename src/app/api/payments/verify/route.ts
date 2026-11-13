import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRazorpay, verifyCheckoutSignature } from "@/lib/razorpay";

export const runtime = "nodejs";
const bodySchema = z.object({
  razorpay_order_id: z.string().min(5).max(80),
  razorpay_payment_id: z.string().min(5).max(80),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i)
});

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Invalid payment verification data." }, { status: 400 });
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = parsed.data;

    if (!verifyCheckoutSignature(orderId, paymentId, signature)) {
      return NextResponse.json({ error: "Payment signature verification failed." }, { status: 400 });
    }

    // RLS ensures the signed-in customer can only verify an order tied to their own linked customer record.
    const { data: localPayment, error: localError } = await supabase.from("payments")
      .select("id,customer_id,amount_paise,status,razorpay_order_id")
      .eq("razorpay_order_id", orderId).maybeSingle();
    if (localError || !localPayment) return NextResponse.json({ error: "Payment order not found for this account." }, { status: 404 });

    const gatewayPayment = await getRazorpay().payments.fetch(paymentId);
    if (gatewayPayment.order_id !== orderId || Number(gatewayPayment.amount) !== Number(localPayment.amount_paise) || gatewayPayment.currency !== "INR") {
      return NextResponse.json({ error: "Payment details do not match the order." }, { status: 400 });
    }
    if (gatewayPayment.status !== "captured") {
      return NextResponse.json({ error: "Payment is not captured yet. Please do not pay again; refresh this page shortly." }, { status: 409 });
    }

    const admin = createAdminClient();
    const { error: captureError } = await admin.rpc("capture_razorpay_payment", {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_amount_paise: Number(gatewayPayment.amount)
    });
    if (captureError) throw captureError;
    revalidatePath(`/account/${localPayment.customer_id}`);
    revalidatePath("/account");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("payment verification failed", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Payment verification is pending." }, { status: 500 });
  }
}
