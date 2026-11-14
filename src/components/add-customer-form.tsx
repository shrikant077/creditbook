"use client";

import { useActionState, useState } from "react";
import { addCustomerAction } from "@/app/dashboard/actions";

export function AddCustomerForm({ storeId }: { storeId: string }) {
  const [state, action, pending] = useActionState(addCustomerAction, {});
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    if (!state.claimCode) return;
    try { await navigator.clipboard.writeText(state.claimCode); setCopied(true); }
    catch { setCopied(false); }
  }
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="storeId" value={storeId} />
        <div className="form-grid">
          <div className="field"><label htmlFor="customerName">Customer name</label><input id="customerName" name="name" required maxLength={120} placeholder="Customer's full name" /></div>
          <div className="field"><label htmlFor="customerEmail">Email address (customer’s CreditBook login)</label><input id="customerEmail" name="email" type="email" autoComplete="email" required maxLength={320} placeholder="customer@example.com" /></div>
          <div className="field"><label htmlFor="customerPhone">Mobile number (with country code)</label><input id="customerPhone" name="phone" type="tel" autoComplete="tel" required placeholder="+919876543210" /></div>
        </div>
        <div className="form-actions"><button className="btn" type="submit" disabled={pending}>{pending ? "Adding…" : "Add customer"}</button><span className="muted text-small">Customer uses this email to sign in; phone is saved as contact information.</span></div>
      </form>
      {state.error && <div className="notice error">{state.error}</div>}
      {state.success && <div className="notice">{state.success}</div>}
      {state.claimCode && <div style={{ marginTop: 12 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>One-time customer access code</div>
        <div className="access-code">{state.claimCode}</div>
        <button type="button" className="btn secondary small" onClick={copyCode} style={{ marginLeft: 9 }}>{copied ? "Copied" : "Copy code"}</button>
        <p className="muted text-small">Share this code privately with the customer. They must create or sign in to their CreditBook account with this email, then enter the code inside the customer dashboard to link your shop. It expires in 7 days and cannot be viewed again after leaving this screen.</p>
      </div>}
    </div>
  );
}
