import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { TransactionList } from "@/components/transaction-list";
import { LogoutButton } from "@/components/logout-button";

export default async function CustomerLedgerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  const { supabase, user } = await requireUser();
  const { data: customer, error } = await supabase.from("customers")
    .select("id,name,email,phone_e164,store_id,stores(name)")
    .eq("id", customerId).eq("user_id", user.id).maybeSingle();
  if (error || !customer) notFound();
  const [{ data: credits }, { data: payments }, { data: balance }] = await Promise.all([
    supabase.from("credit_entries").select("id,description,amount_paise,created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.from("payments").select("id,amount_paise,method,status,created_at").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabase.rpc("get_customer_balance", { p_customer_id: customerId })
  ]);
  const due = Number(balance ?? 0);
  const storeRelation = customer.stores as unknown as { name: string } | null;
  const storeName = storeRelation?.name ?? "Store";
  return <>
    <header className="topbar"><div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}><Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link><nav className="nav"><Link href="/account" className="btn secondary small">All shops</Link><LogoutButton /></nav></div></header>
    <main className="shell page">
      <Link href="/account" className="back-link">← Back to your shops</Link>
      <div className="page-head"><div><div className="eyebrow">Shop ledger / {storeName}</div><h1>Hello, {customer.name}</h1><p>Here is your credit and payment history with {storeName}.</p></div><span className="pill">Your account</span></div>
      <div className="two-col" style={{ alignItems: "start" }}>
        <div>
          <div className="balance-card"><span>Outstanding balance</span><strong>{formatINR(due)}</strong><small>Updated from verified credits and payments</small></div>
          <section className="panel"><h2>Make a payment</h2><p className="muted text-small">Online payments will be enabled after your store connects its own approved payment account.</p><div className="divider"/>
            {due > 0 ? <div className="notice">Please settle your outstanding balance directly with the store for now. Your store can record the payment in CreditBook.</div> : <div className="notice">You have no outstanding balance. Thank you!</div>}
          </section>
        </div>
        <section className="panel"><h2>Account summary</h2><div className="ledger-item"><div><div className="ledger-title">Store</div><div className="ledger-meta">Credit account</div></div><strong>{storeName}</strong></div><div className="ledger-item"><div><div className="ledger-title">Email address</div><div className="ledger-meta">CreditBook login</div></div><strong>{customer.email ?? "Not provided"}</strong></div><div className="ledger-item"><div><div className="ledger-title">Mobile number</div><div className="ledger-meta">Contact information</div></div><strong>{customer.phone_e164}</strong></div><div className="ledger-item"><div><div className="ledger-title">Credit entries</div></div><strong>{credits?.length ?? 0}</strong></div><div className="ledger-item"><div><div className="ledger-title">Payment records</div></div><strong>{payments?.filter(p => p.status === "captured").length ?? 0}</strong></div></section>
      </div>
      <section className="panel"><div className="panel-head"><div><h2>Itemised history</h2><p className="muted text-small">Every credit entry and recorded payment is shown below.</p></div></div><TransactionList credits={credits ?? []} payments={payments ?? []} /></section>
    </main>
  </>;
}
