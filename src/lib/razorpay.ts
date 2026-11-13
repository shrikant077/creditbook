import "server-only";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";

export function getRazorpay() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are not configured.");
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
}

function safeHexEqual(expected: string, received: string): boolean {
  if (!/^[a-f0-9]+$/i.test(received) || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received, "hex"));
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) throw new Error("Razorpay secret is not configured.");
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  return safeHexEqual(expected, signature);
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("Razorpay webhook secret is not configured.");
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeHexEqual(expected, signature);
}
