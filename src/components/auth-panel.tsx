"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function AuthPanel() {
  const router = useRouter();
  const supabase = createClient();
  const [accountType, setAccountType] = useState<"store" | "customer">("store");
  const [storeMode, setStoreMode] = useState<"signin" | "signup">("signup");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [phone, setPhone] = useState("");

  function notify(text: string, error = false) {
    setMessage(text);
    setIsError(error);
  }

  async function handleStoreAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); notify("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
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

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); notify("");
    const cleanPhone = phone.trim();
    if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) {
      notify("Use international format, for example +919876543210.", true); setBusy(false); return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: cleanPhone, options: { shouldCreateUser: true, channel: "sms" } });
      if (error) throw error;
      setOtpSent(true); notify("OTP sent. Check your SMS messages.");
    } catch (error) { notify(error instanceof Error ? error.message : "Could not send OTP.", true); }
    finally { setBusy(false); }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); notify("");
    const form = new FormData(event.currentTarget);
    const token = String(form.get("otp") ?? "").trim();
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token, type: "sms" });
      if (error) throw error;
      router.push("/account"); router.refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "OTP verification failed.", true); }
    finally { setBusy(false); }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link>
        <p className="eyebrow" style={{ marginTop: 25 }}>Welcome</p>
        <h1>Sign in to continue</h1>
        <p className="muted">Choose how you use CreditBook.</p>
        <div className="tabs">
          <button className={`tab ${accountType === "store" ? "active" : ""}`} onClick={() => { setAccountType("store"); notify(""); }}>Store owner</button>
          <button className={`tab ${accountType === "customer" ? "active" : ""}`} onClick={() => { setAccountType("customer"); notify(""); }}>Customer</button>
        </div>
        {accountType === "store" ? (
          <>
            <div className="tabs" style={{ marginTop: 0 }}>
              <button className={`tab ${storeMode === "signup" ? "active" : ""}`} onClick={() => setStoreMode("signup")}>Create store</button>
              <button className={`tab ${storeMode === "signin" ? "active" : ""}`} onClick={() => setStoreMode("signin")}>Sign in</button>
            </div>
            <form onSubmit={handleStoreAuth}>
              {storeMode === "signup" && <>
                <div className="field"><label htmlFor="fullName">Your name</label><input id="fullName" name="fullName" autoComplete="name" required placeholder="e.g. Rahul Sharma" /></div>
                <div className="field"><label htmlFor="storeName">Store name</label><input id="storeName" name="storeName" required minLength={2} placeholder="e.g. Sharma General Store" /></div>
              </>}
              <div className="field"><label htmlFor="email">Email</label><input id="email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></div>
              <div className="field"><label htmlFor="password">Password</label><input id="password" name="password" type="password" autoComplete={storeMode === "signup" ? "new-password" : "current-password"} minLength={8} required placeholder="At least 8 characters" /></div>
              <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? <><span className="spinner"/> Please wait</> : storeMode === "signup" ? "Create store account" : "Sign in to dashboard"}</button>
            </form>
          </>
        ) : (
          <>
            {!otpSent ? <form onSubmit={sendOtp}>
              <div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+919876543210" required /></div>
              <p className="muted text-small">Use the same number your store registered. You will also need the one-time access code provided by the store to link your account.</p>
              <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Sending…" : "Send OTP"}</button>
            </form> : <form onSubmit={verifyOtp}>
              <div className="notice">OTP sent to {phone}. <button type="button" className="link-button" onClick={() => { setOtpSent(false); notify(""); }}>Change number</button></div>
              <div className="field"><label htmlFor="otp">6-digit OTP</label><input id="otp" name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required placeholder="Enter OTP" /></div>
              <button className="btn" type="submit" disabled={busy} style={{ width: "100%" }}>{busy ? "Verifying…" : "Verify and continue"}</button>
            </form>}
          </>
        )}
        {message && <div className={`notice ${isError ? "error" : ""}`} role="status">{message}</div>}
        <div className="divider" />
        <p className="muted text-small">By continuing, you agree to use this service only for accurate credit and payment records.</p>
      </div>
    </div>
  );
}
