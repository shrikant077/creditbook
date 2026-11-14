"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createCustomerAccountAction } from "@/app/account/auth-actions";

export function AuthPanel() {
  const router = useRouter();
  const supabase = createClient();
  const [accountType, setAccountType] = useState<"store" | "customer">("customer");
  const [storeMode, setStoreMode] = useState<"signin" | "signup">("signup");
  const [customerMode, setCustomerMode] = useState<"signin" | "signup">("signup");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function handleStoreAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); notify("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    try {
      if (storeMode === "signup") {
        const fullName = String(form.get("fullName") ?? "").trim();
        const storeName = String(form.get("storeName") ?? "").trim();
        if (fullName.length < 2 || storeName.length < 2 || password.length < 8) {
          notify("Enter your name and store name. Password must be at least 8 characters.", true); return;
        }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName, account_type: "store_owner", store_name: storeName } }
        });
        if (error) throw error;
        if (data.session) { router.push("/dashboard"); router.refresh(); }
        else notify("Account created. Check your email to confirm your account, then sign in.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/dashboard");
        router.refresh();
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "Authentication failed.", true);
    } finally { setBusy(false); }
  }

  async function handleCustomerAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); notify("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    try {
      if (customerMode === "signup") {
        const result = await createCustomerAccountAction(form);
        if (result.error) {
          notify(result.error, true);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        if (customerMode === "signup") {
          notify("Your account was created, but automatic sign-in failed. Please use Sign in with the same email and password.", true);
          setCustomerMode("signin");
          return;
        }
        throw error;
      }
      router.push("/account");
      router.refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Authentication failed.", true);
    } finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link>
        <p className="eyebrow" style={{ marginTop: 25 }}>Welcome</p>
        <h1>Sign in to continue</h1>
        <p className="muted">Choose how you use CreditBook.</p>
        <div className="tabs">
          <button type="button" className={`tab ${accountType === "customer" ? "active" : ""}`} onClick={() => { setAccountType("customer"); notify(""); }}>Customer</button>
          <button type="button" className={`tab ${accountType === "store" ? "active" : ""}`} onClick={() => { setAccountType("store"); notify(""); }}>Store owner</button>
        </div>
        {accountType === "store" ? (
          <>
            <div className="tabs" style={{ marginTop: 0 }}>
              <button type="button" className={`tab ${storeMode === "signup" ? "active" : ""}`} onClick={() => { setStoreMode("signup"); notify(""); }}>Create store</button>
              <button type="button" className={`tab ${storeMode === "signin" ? "active" : ""}`} onClick={() => { setStoreMode("signin"); notify(""); }}>Sign in</button>
            </div>
            <form onSubmit={handleStoreAuth}>
              {storeMode === "signup" && <>
                <div className="field"><label htmlFor="fullName">Your name</label><input id="fullName" name="fullName" autoComplete="name" required placeholder="e.g. Rahul Sharma" /></div>
                <div className="field"><label htmlFor="storeName">Store name</label><input id="storeName" name="storeName" required minLength={2} placeholder="e.g. Sharma General Store" /></div>
              </>}
              <div className="field"><label htmlFor="storeEmail">Email</label><input id="storeEmail" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></div>
              <div className="field"><label htmlFor="storePassword">Password</label><input id="storePassword" name="password" type="password" autoComplete={storeMode === "signup" ? "new-password" : "current-password"} minLength={8} required placeholder="At least 8 characters" /></div>
              <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? <><span className="spinner"/> Please wait</> : storeMode === "signup" ? "Create store account" : "Sign in to dashboard"}</button>
            </form>
          </>
        ) : (
          <>
            <div className="tabs" style={{ marginTop: 0 }}>
              <button type="button" className={`tab ${customerMode === "signup" ? "active" : ""}`} onClick={() => { setCustomerMode("signup"); notify(""); }}>Create account</button>
              <button type="button" className={`tab ${customerMode === "signin" ? "active" : ""}`} onClick={() => { setCustomerMode("signin"); notify(""); }}>Sign in</button>
            </div>
            <form onSubmit={handleCustomerAuth}>
              <div className="field"><label htmlFor="customerEmail">Email address</label><input id="customerEmail" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></div>
              <div className="field"><label htmlFor="customerPassword">Password</label><input id="customerPassword" name="password" type="password" autoComplete={customerMode === "signup" ? "new-password" : "current-password"} minLength={8} required placeholder="At least 8 characters" /></div>
              {customerMode === "signup" ? <p className="muted text-small">Create one CreditBook account here. No shop code is needed yet. After signing in, use “Link a shop” to connect each shop with its own one-time access code. Use an email address you control; signup does not send a verification email.</p> : <p className="muted text-small">Sign in to see all the shops linked to your CreditBook account. To connect another shop, enter its one-time code inside your dashboard.</p>}
              <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? <><span className="spinner"/> Please wait</> : customerMode === "signup" ? "Create customer account" : "Sign in to CreditBook"}</button>
            </form>
          </>
        )}
        {message && <div className={`notice ${isError ? "error" : ""}`} role="status">{message}</div>}
        <div className="divider" />
        <p className="muted text-small">By continuing, you agree to use this service only for accurate credit and payment records.</p>
      </div>
    </div>
  );
}
