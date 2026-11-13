"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { hashClaimCode } from "@/lib/claim-code";
import { claimCodeSchema } from "@/lib/validators";
import type { ActionState } from "@/app/dashboard/actions";

export async function claimCustomerRecordAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const user = data.user;
    if (error || !user) return { error: "Please sign in again." };
    if (!user.email || !user.email_confirmed_at) return { error: "A verified email address is required to claim a store record." };
    const code = claimCodeSchema.safeParse(formData.get("claimCode"));
    if (!code.success) return { error: "Enter the 8-digit access code." };

    const email = user.email.trim().toLowerCase();
    const digest = hashClaimCode(email, code.data);
    const admin = createAdminClient();
    const { data: customerId, error: claimError } = await admin.rpc("claim_customer_record", {
      p_email: email,
      p_claim_hash: digest,
      p_user_id: user.id
    });
    if (claimError) throw claimError;
    if (!customerId) return { error: "That code is invalid or expired, or too many attempts were made. Check the email address and try again later." };
    revalidatePath("/account");
    return { success: "Store account linked. Your credit ledger is now available." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not claim this store account." };
  }
}
