"use server";

import { createHmac } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailSchema } from "@/lib/validators";

export type CustomerSignupResult = { error?: string; success?: string };

/**
 * Creates customer accounts without sending an email confirmation.
 * The Supabase service key stays on the server. The customer must still
 * provide each shop's one-time code after signing in to link that shop.
 */
export async function createCustomerAccountAction(formData: FormData): Promise<CustomerSignupResult> {
  const emailResult = emailSchema.safeParse(formData.get("email"));
  const password = String(formData.get("password") ?? "");

  if (!emailResult.success) return { error: "Enter a valid email address." };
  if (password.length < 8 || password.length > 72) {
    return { error: "Password must be between 8 and 72 characters." };
  }

  try {
    const requestHeaders = await headers();
    // Netlify supplies x-nf-client-connection-ip. x-forwarded-for is a fallback
    // for local development and other trusted reverse proxies.
    const ip = requestHeaders.get("x-nf-client-connection-ip")
      ?? requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? "unknown";
    const serverSecret = process.env.SUPABASE_SECRET_KEY;
    if (!serverSecret) throw new Error("Server authentication is not configured.");

    const ipHash = createHmac("sha256", serverSecret).update(ip).digest("hex");
    const admin = createAdminClient();
    const { data: allowed, error: limitError } = await admin.rpc("allow_customer_signup", {
      p_ip_hash: ipHash
    });
    if (limitError) throw new Error("Could not validate this signup request. Please try again later.");
    if (!allowed) return { error: "Too many signup attempts from this network. Please try again in an hour." };

    const { error } = await admin.auth.admin.createUser({
      email: emailResult.data,
      password,
      // This skips email delivery only. It does not prove ownership of the email.
      // The shop-issued access code is checked separately when linking a shop.
      email_confirm: true,
      user_metadata: { account_type: "customer" }
    });

    if (error) {
      if (/already registered|already been registered|duplicate key/i.test(error.message)) {
        return { error: "An account with this email already exists. Choose Sign in instead." };
      }
      throw error;
    }

    return { success: "Account created. Signing you in…" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create your account." };
  }
}
