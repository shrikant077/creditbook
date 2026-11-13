import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { AddCreditForm, IssueAccessCodeForm, OfflinePaymentForm } from "@/components/credit-forms";
import { TransactionList } from "@/components/transaction-list";
import { LogoutButton } from "@/components/logout-button";

export default async function StoreCustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const { supabase, user } = await requireUser();
  const { data: customer, error } = await supabase.from("customers")
    .select("id,name,phone_e164,store_id,user_id,created_at")
    .eq("id", customerId).maybeSingle();
  if (error || !customer) notFound();
  const { data: store } = await supabase.from("stores").select("id,name,owner_id").eq("id", customer.store_id).eq("owner_id", user.id).maybeSingle();
  if (!store) notFound();
  const [{ data: credits }, { data: payments }, { data: balance }] = await Promise.all([
    supabase.from("credit_entries").select("id,description,amount_paise,created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("payments").select("id,amount_paise,method,status,created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.rpc("get_customer_balance", { p_customer_id: customerId })
  ]);
  const due = Number(balance ?? 0);
  return <>
    <header className="topbar"><div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}><Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link><nav className="nav"><Link href="/dashboard" className="btn secondary small">Dashboard</Link><LogoutButton /></nav></div></header>
    <main className="shell page">
      <Link href="/dashboard" className="back-link">← Back to customers</Link>
      <div className="page-head"><div><div className="eyebrow">{store.name} / Customer ledger</div><h1>{customer.name}</h1><p>{customer.phone_e164} · Added {new Date(customer.created_at).toLocaleDateString("en-IN")}</p></div>{customer.user_id ? <span className="pill">Customer portal linked</span> : <span className="pill" style={{ background: "#fff4e8", color: "#9b5a1c" }}>Not claimed</span>}</div>
      <div className="balance-card"><span>Outstanding balance</span><strong>{formatINR(due)}</strong><small>Credits minus successfully captured payments</small></div>
      {!customer.user_id && <section className="panel"><h2>Customer portal access</h2><p className="muted text-small">The customer must sign in with this phone number and claim the store record using a one-time access code.</p><IssueAccessCodeForm storeId={store.id} customerId={customer.id} /></section>}
      <div className="two-col">
        <section className="panel"><h2>Add credit</h2><p className="muted text-small">Record what the customer took on credit.</p><div className="divider"/><AddCreditForm storeId={store.id} customerId={customer.id} /></section>
        <section className="panel"><h2>Record offline payment</h2><p className="muted text-small">Use this when the customer pays at the store.</p><div className="divider"/><OfflinePaymentForm storeId={store.id} customerId={customer.id} /></section>
      </div>
      <section className="panel"><div className="panel-head"><div><h2>Transaction history</h2><p className="muted text-small">Credit entries and payments are preserved as separate records.</p></div></div><TransactionList credits={credits ?? []} payments={payments ?? []} /></section>
    </main>
  </>;
}
