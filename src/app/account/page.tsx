import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { ClaimCustomerForm } from "@/components/claim-customer-form";
import { LogoutButton } from "@/components/logout-button";

export default async function CustomerAccountPage() {
  const { supabase, user } = await requireUser();
  const { data: customers } = await supabase.from("customers")
    .select("id,name,phone_e164,store_id,stores(name)")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  const rows = await Promise.all((customers ?? []).map(async customer => {
    const { data: balance } = await supabase.rpc("get_customer_balance", { p_customer_id: customer.id });
    const storeRelation = customer.stores as unknown as { name: string } | null;
    return { ...customer, storeName: storeRelation?.name ?? "Store", balance: Number(balance ?? 0) };
  }));
  return <>
    <header className="topbar"><div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}><Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link><nav className="nav"><span className="muted text-small hide-mobile">Customer account</span><LogoutButton /></nav></div></header>
    <main className="shell page">
      <div className="page-head"><div><div className="eyebrow">Customer portal</div><h1>Your store credits</h1><p>View your balances and payment history across linked stores.</p></div><span className="pill">{user.phone && user.phone_confirmed_at ? "Phone verified" : "Account"}</span></div>
      {user.phone && user.phone_confirmed_at ? <ClaimCustomerForm /> : <div className="panel"><h2>Customer phone sign-in required</h2><p className="muted text-small">To link a store credit account, sign out and use the Customer sign-in tab with the mobile number registered by your store.</p><Link href="/login" className="btn secondary small">Go to sign in</Link></div>}
      <section className="panel"><div className="panel-head"><div><h2>Linked stores</h2><p className="muted text-small">Each store account is linked separately using its access code.</p></div><span className="pill">{rows.length} linked</span></div>
        {rows.length === 0 ? <div className="empty"><strong>No store accounts linked yet</strong>Ask your store for an access code, then enter it above. Make sure you signed in with the same mobile number the store registered.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Store</th><th>Customer name</th><th>Outstanding</th><th></th></tr></thead><tbody>
          {rows.map(customer => <tr key={customer.id}><td><strong>{customer.storeName}</strong></td><td>{customer.name}</td><td className="amount">{formatINR(customer.balance)}</td><td><Link href={`/account/${customer.id}`} className="btn secondary small">View ledger</Link></td></tr>)}
        </tbody></table></div>}
      </section>
    </main>
  </>;
}
