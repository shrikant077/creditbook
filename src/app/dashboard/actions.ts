"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateClaimCode, hashClaimCode } from "@/lib/claim-code";
import { rupeesToPaise } from "@/lib/money";
import { customerNameSchema, descriptionSchema, emailSchema, phoneSchema, amountRupeesSchema, storeNameSchema } from "@/lib/validators";

export type ActionState = { error?: string; success?: string; claimCode?: string };

async function getSignedInUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in again.");
  return { supabase, user: data.user };
}

async function assertStoreOwner(supabase: Awaited<ReturnType<typeof createClient>>, storeId: string, userId: string) {
  const { data, error } = await supabase.from("stores").select("id").eq("id", storeId).eq("owner_id", userId).maybeSingle();
  if (error || !data) throw new Error("Store not found or access denied.");
}

export async function createStoreAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await getSignedInUser();
    const parsed = storeNameSchema.safeParse(formData.get("storeName"));
    if (!parsed.success) return { error: "Enter a store name between 2 and 120 characters." };
    const { data: existing } = await supabase.from("stores").select("id").eq("owner_id", user.id).maybeSingle();
    if (existing) return { success: "Your store is already set up." };
    const { error } = await supabase.from("stores").insert({ owner_id: user.id, name: parsed.data });
    if (error) throw error;
    revalidatePath("/dashboard");
    return { success: "Store created successfully." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create store." };
  }
}

export async function addCustomerAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await getSignedInUser();
    const storeId = String(formData.get("storeId") ?? "");
    const name = customerNameSchema.safeParse(formData.get("name"));
    const email = emailSchema.safeParse(formData.get("email"));
    const phone = phoneSchema.safeParse(formData.get("phone"));
    if (!name.success) return { error: "Enter the customer's name." };
    if (!email.success) return { error: email.error.issues[0]?.message ?? "Enter a valid email address." };
    if (!phone.success) return { error: phone.error.issues[0]?.message ?? "Enter a valid E.164 phone number." };
    await assertStoreOwner(supabase, storeId, user.id);

    const claimCode = generateClaimCode();
    const claimCodeHash = hashClaimCode(email.data, claimCode);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("customers").insert({
      store_id: storeId,
      name: name.data,
      email: email.data,
      phone_e164: phone.data,
      claim_code_hash: claimCodeHash,
      claim_code_expires_at: expiresAt
    });
    if (error?.code === "23505") return { error: "A customer with this email address or phone number already exists in this store." };
    if (error) throw error;
    revalidatePath("/dashboard");
    return { success: "Customer added. Share this one-time access code privately with them.", claimCode };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add customer." };
  }
}

export async function updateCustomerContactAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await getSignedInUser();
    const storeId = String(formData.get("storeId") ?? "");
    const customerId = String(formData.get("customerId") ?? "");
    const email = emailSchema.safeParse(formData.get("email"));
    const phone = phoneSchema.safeParse(formData.get("phone"));
    if (!email.success) return { error: email.error.issues[0]?.message ?? "Enter a valid email address." };
    if (!phone.success) return { error: phone.error.issues[0]?.message ?? "Enter a valid E.164 phone number." };
    await assertStoreOwner(supabase, storeId, user.id);
    const { data: customer, error: lookupError } = await supabase.from("customers")
      .select("id,email,user_id").eq("id", customerId).eq("store_id", storeId).single();
    if (lookupError || !customer) throw new Error("Customer not found.");

    // A phone-only edit must not break the customer's existing global account link.
    if ((customer.email ?? "").trim().toLowerCase() === email.data) {
      const { error } = await supabase.from("customers").update({ phone_e164: phone.data })
        .eq("id", customerId).eq("store_id", storeId);
      if (error?.code === "23505") return { error: "A customer with this phone number already exists in this store." };
      if (error) throw error;
      revalidatePath(`/dashboard/customers/${customerId}`);
      revalidatePath("/dashboard");
      return { success: "Phone number updated. The customer's existing shop link was preserved." };
    }

    const code = generateClaimCode();
    const hash = hashClaimCode(email.data, code);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("customers").update({
      email: email.data,
      phone_e164: phone.data,
      user_id: null,
      claim_code_hash: hash,
      claim_code_expires_at: expiresAt
    }).eq("id", customerId).eq("store_id", storeId);
    if (error?.code === "23505") return { error: "A customer with this email address or phone number already exists in this store." };
    if (error) throw error;
    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath("/dashboard");
    revalidatePath(`/account/${customerId}`);
    revalidatePath("/account");
    return { success: "Email updated and this shop was unlinked from the previous CreditBook account. Share the new one-time access code to link it again.", claimCode: code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not update customer details." };
  }
}

export async function issueAccessCodeAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await getSignedInUser();
    const storeId = String(formData.get("storeId") ?? "");
    const customerId = String(formData.get("customerId") ?? "");
    await assertStoreOwner(supabase, storeId, user.id);
    const { data: customer, error: customerError } = await supabase
      .from("customers").select("id, email, user_id")
      .eq("id", customerId).eq("store_id", storeId).single();
    if (customerError || !customer) throw new Error("Customer not found.");
    if (customer.user_id) return { error: "This customer has already claimed their account." };
    if (!customer.email) return { error: "Add the customer's email address before issuing an access code." };
    const code = generateClaimCode();
    const hash = hashClaimCode(customer.email, code);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase.from("customers")
      .update({ claim_code_hash: hash, claim_code_expires_at: expiresAt })
      .eq("id", customerId).eq("store_id", storeId);
    if (error) throw error;
    revalidatePath(`/dashboard/customers/${customerId}`);
    return { success: "New access code generated. Share it privately with the customer.", claimCode: code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not issue access code." };
  }
}

export async function addCreditAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await getSignedInUser();
    const storeId = String(formData.get("storeId") ?? "");
    const customerId = String(formData.get("customerId") ?? "");
    const description = descriptionSchema.safeParse(formData.get("description"));
    const amount = amountRupeesSchema.safeParse(formData.get("amount"));
    if (!description.success) return { error: "Describe the items or reason for the credit (max 500 characters)." };
    if (!amount.success) return { error: "Enter a valid amount." };
    await assertStoreOwner(supabase, storeId, user.id);
    const { data: customer, error: customerError } = await supabase.from("customers")
      .select("id").eq("id", customerId).eq("store_id", storeId).maybeSingle();
    if (customerError || !customer) throw new Error("Customer not found.");
    const amountPaise = rupeesToPaise(amount.data);
    const { error } = await supabase.from("credit_entries").insert({
      store_id: storeId,
      customer_id: customerId,
      description: description.data,
      amount_paise: amountPaise,
      created_by: user.id
    });
    if (error) throw error;
    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath("/dashboard");
    revalidatePath(`/account/${customerId}`);
    return { success: "Credit entry added." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not add credit entry." };
  }
}

export async function recordOfflinePaymentAction(_previous: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const { supabase, user } = await getSignedInUser();
    const storeId = String(formData.get("storeId") ?? "");
    const customerId = String(formData.get("customerId") ?? "");
    const amount = amountRupeesSchema.safeParse(formData.get("amount"));
    const method = String(formData.get("method") ?? "");
    if (!amount.success) return { error: "Enter a valid payment amount." };
    if (!(["cash", "upi", "bank_transfer"] as string[]).includes(method)) return { error: "Choose a valid payment method." };
    await assertStoreOwner(supabase, storeId, user.id);
    const amountPaise = rupeesToPaise(amount.data);
    const { error } = await supabase.rpc("record_offline_payment", {
      p_customer_id: customerId,
      p_amount_paise: amountPaise,
      p_method: method
    });
    if (error) throw error;
    revalidatePath(`/dashboard/customers/${customerId}`);
    revalidatePath("/dashboard");
    revalidatePath(`/account/${customerId}`);
    return { success: "Payment recorded successfully." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not record payment." };
  }
}
