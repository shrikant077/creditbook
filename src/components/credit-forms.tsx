"use client";

import { useActionState, useState } from "react";
import { addCreditAction, recordOfflinePaymentAction, issueAccessCodeAction } from "@/app/dashboard/actions";

export function AddCreditForm({ storeId, customerId }: { storeId: string; customerId: string }) {
  const [state, action, pending] = useActionState(addCreditAction, {});
  return <form action={action}>
    <input type="hidden" name="storeId" value={storeId} /><input type="hidden" name="customerId" value={customerId} />
    <div className="field"><label htmlFor="creditDescription">Items / description</label><textarea id="creditDescription" name="description" required maxLength={500} placeholder="e.g. 5 kg rice, 2 L oil, household items" /></div>
    <div className="field"><label htmlFor="creditAmount">Amount (₹)</label><input id="creditAmount" name="amount" inputMode="decimal" required placeholder="850.00" /></div>
    <button className="btn" type="submit" disabled={pending}>{pending ? "Saving…" : "Add credit"}</button>
    {state.error && <div className="notice error">{state.error}</div>}{state.success && <div className="notice">{state.success}</div>}
  </form>;
}

export function OfflinePaymentForm({ storeId, customerId }: { storeId: string; customerId: string }) {
  const [state, action, pending] = useActionState(recordOfflinePaymentAction, {});
  return <form action={action}>
    <input type="hidden" name="storeId" value={storeId} /><input type="hidden" name="customerId" value={customerId} />
    <div className="field"><label htmlFor="offlineAmount">Amount received (₹)</label><input id="offlineAmount" name="amount" inputMode="decimal" required placeholder="500.00" /></div>
    <div className="field"><label htmlFor="offlineMethod">Payment method</label><select id="offlineMethod" name="method" defaultValue="cash"><option value="cash">Cash</option><option value="upi">UPI (received at store)</option><option value="bank_transfer">Bank transfer</option></select></div>
    <button className="btn secondary" type="submit" disabled={pending}>{pending ? "Recording…" : "Record payment"}</button>
    {state.error && <div className="notice error">{state.error}</div>}{state.success && <div className="notice">{state.success}</div>}
  </form>;
}

export function IssueAccessCodeForm({ storeId, customerId }: { storeId: string; customerId: string }) {
  const [state, action, pending] = useActionState(issueAccessCodeAction, {});
  const [copied, setCopied] = useState(false);
  async function copyCode() {
    if (!state.claimCode) return;
    try { await navigator.clipboard.writeText(state.claimCode); setCopied(true); } catch { setCopied(false); }
  }
  return <form action={action}>
    <input type="hidden" name="storeId" value={storeId} /><input type="hidden" name="customerId" value={customerId} />
    <button className="btn secondary small" type="submit" disabled={pending}>{pending ? "Generating…" : "Generate new access code"}</button>
    {state.error && <div className="notice error">{state.error}</div>}{state.success && <div className="notice">{state.success}</div>}
    {state.claimCode && <div style={{ marginTop: 10 }}><div className="access-code">{state.claimCode}</div><button type="button" className="btn secondary small" onClick={copyCode} style={{ marginLeft: 9 }}>{copied ? "Copied" : "Copy code"}</button><p className="muted text-small">Share this code privately. It expires in 7 days.</p></div>}
  </form>;
}
