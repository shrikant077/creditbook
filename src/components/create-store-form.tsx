"use client";

import { useActionState } from "react";
import { createStoreAction } from "@/app/dashboard/actions";

export function CreateStoreForm() {
  const [state, action, pending] = useActionState(createStoreAction, {});
  return <form action={action}>
    <div className="field"><label htmlFor="storeName">Store name</label><input id="storeName" name="storeName" required minLength={2} maxLength={120} placeholder="Your store name" /></div>
    <button className="btn" type="submit" disabled={pending}>{pending ? "Creating…" : "Create store"}</button>
    {state.error && <div className="notice error">{state.error}</div>}{state.success && <div className="notice">{state.success}</div>}
  </form>;
}
