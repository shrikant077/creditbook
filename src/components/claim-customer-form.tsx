"use client";

import { useActionState } from "react";
import { claimCustomerRecordAction } from "@/app/account/actions";

export function ClaimCustomerForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(claimCustomerRecordAction, {});
  return <div className="panel">
    <h2>Link a store account</h2>
    <p className="muted text-small">Enter the 8-digit one-time code given to you by the store. You must be signed in with the same verified email address the store registered: {email}.</p>
    <form action={action} className="inline-form">
      <div className="field"><label htmlFor="claimCode">Store access code</label><input id="claimCode" name="claimCode" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} required placeholder="8-digit code" /></div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Linking…" : "Link store"}</button>
    </form>
    {state.error && <div className="notice error">{state.error}</div>}{state.success && <div className="notice">{state.success}</div>}
  </div>;
}
