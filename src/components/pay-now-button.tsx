"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector<HTMLScriptElement>('script[data-razorpay="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      existing.addEventListener("error", () => resolve(false), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "true";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function PayNowButton({ customerId, customerName, balancePaise }: { customerId: string; customerName: string; balancePaise: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState((balancePaise / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  async function pay() {
    setBusy(true); setMessage(""); setIsError(false);
    try {
      const scriptReady = await loadRazorpay();
      if (!scriptReady || !window.Razorpay) throw new Error("Could not load the payment window. Please try again.");
      const cleanAmount = amount.trim();
      if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(cleanAmount)) throw new Error("Enter a valid amount with up to two decimal places.");
      const [whole, fraction = ""] = cleanAmount.split(".");
      const amountPaise = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
      if (!Number.isSafeInteger(amountPaise) || amountPaise < 100 || amountPaise > balancePaise) {
        throw new Error("Enter an amount of at least ₹1 and no more than the outstanding balance.");
      }
      const response = await fetch("/api/payments/create-order", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, amountPaise })
      });
      const order = await response.json();
      if (!response.ok) throw new Error(order.error ?? "Could not create payment order.");
      const resumed = order.amountPaise !== amountPaise;
      if (resumed) setMessage(`Resuming your existing pending payment of ₹${(order.amountPaise / 100).toFixed(2)}.`);
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amountPaise,
        currency: "INR",
        name: "CreditBook",
        description: `Credit settlement — ${customerName}`,
        order_id: order.orderId,
        prefill: { name: customerName },
        theme: { color: "#176b45" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (result: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const verification = await fetch("/api/payments/verify", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify(result)
            });
            const verificationResult = await verification.json();
            if (!verification.ok) throw new Error(verificationResult.error ?? "Payment verification is pending.");
            setMessage("Payment verified successfully. Your balance has been updated.");
            setBusy(false); router.refresh();
          } catch (error) {
            setIsError(true);
            setMessage(error instanceof Error ? error.message : "Payment was received but verification is still pending. Refresh shortly.");
            setBusy(false); router.refresh();
          }
        }
      });
      checkout.open();
    } catch (error) {
      setIsError(true); setMessage(error instanceof Error ? error.message : "Could not start payment."); setBusy(false);
    }
  }

  return <div>
    <div className="field"><label htmlFor="onlineAmount">Amount to pay (₹)</label><input id="onlineAmount" value={amount} onChange={e => setAmount(e.target.value)} inputMode="decimal" /></div>
    <button className="btn" type="button" onClick={pay} disabled={busy || balancePaise < 100} style={{ width: "100%" }}>{busy ? <><span className="spinner"/> Processing</> : "Pay securely with Razorpay"}</button>
    {message && <div className={`notice ${isError ? "error" : ""}`} role="status">{message}</div>}
    <p className="muted text-small" style={{ marginTop: 10 }}>You can pay the full balance or make a partial payment. Payment is reflected after server verification.</p>
  </div>;
}
