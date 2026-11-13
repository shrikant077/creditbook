"use client";

import { useActionState, useState } from "react";
import { updateCustomerContactAction } from "@/app/dashboard/actions";

export function EditCustomerContactForm({ storeId, customerId, email, phone }: {
  storeId: string; customerId: string; email: string | null; phone: string;
}) {
  const [state, action, pending] = useActionState(updateCustomerContactAction, {});
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    if (!state.claimCode) return;
    try { await navigator.clipboard.writeText(state.claimCode); setCopied(true); }
    catch { setCopied(false); }
  }
  return <div>
    <form action={action}>
      <input type="hidden" name="storeId" value={storeId} />
      <input type="hidden" name="customerId" value={customerId} />
      <div className="form-grid">
        <div className="field"><label htmlFor="editCustomerEmail">Email address (for OTP login)</label><input id="editCustomerEmail" name="email" type="email" autoComplete="email" required maxLength={320} defaultValue={email ?? ""} placeholder="customer@example.com" /></div>
        <div className="field"><label htmlFor="editCustomerPhone">Mobile number (contact only)</label><input id="editCustomerPhone" name="phone" type="tel" autoComplete="tel" required defaultValue={phone} placeholder="+919876543210" /></div>
      </div>
      <div className="form-actions"><button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Save details & generate new code"}</button></div>
    </form>
    {state.error && <div className="notice error">{state.error}</div>}
    {state.success && <div className="notice">{state.success}</div>}
    {state.claimCode && <div style={{ marginTop: 12 }}><div className="eyebrow" style={{ marginBottom: 8 }}>One-time customer access code</div><div className="access-code">{state.claimCode}</div><button type="button" className="btn secondary small" onClick={copyCode} style={{ marginLeft: 9 }}>{copied ? "Copied" : "Copy code"}</button><p className="muted text-small">Share this new code privately. It expires in 7 days.</p></div>}
  </div>;
}
