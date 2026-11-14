import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { ClaimCustomerForm } from "@/components/claim-customer-form";
import { LogoutButton } from "@/components/logout-button";

export default async function CustomerAccountPage() {
  const { supabase, user } = await requireUser();
  const { data: customers } = await supabase.from("customers")
    .select("id,name,email,phone_e164,store_id,stores(name)")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  const rows = await Promise.all((customers ?? []).map(async customer => {
    const { data: balance } = await supabase.rpc("get_customer_balance", { p_customer_id: customer.id });
    const storeRelation = customer.stores as unknown as { name: string } | null;
    return { ...customer, storeName: storeRelation?.name ?? "Shop", balance: Number(balance ?? 0) };
  }));
  const totalDuePaise = rows.reduce((total, customer) => total + customer.balance, 0);
  return <>
    <header className="topbar"><div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}><Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link><nav className="nav"><span className="muted text-small hide-mobile">Customer account</span><LogoutButton /></nav></div></header>
    <main className="shell page">
      <div className="page-head"><div><div className="eyebrow">Customer portal</div><h1>Your CreditBook</h1><p>One account for your credit and payment history across shops.</p></div><span className="pill">{user.email}</span></div>
      <div className="balance-card"><span>Total outstanding across linked shops</span><strong>{formatINR(totalDuePaise)}</strong><small>{rows.length} linked {rows.length === 1 ? "shop account" : "shop accounts"}</small></div>
      <ClaimCustomerForm email={user.email ?? "your account email"} />
      <section className="panel"><div className="panel-head"><div><h2>Linked shops</h2><p className="muted text-small">Each shop is connected separately using its own one-time access code.</p></div><span className="pill">{rows.length} linked</span></div>
        {rows.length === 0 ? <div className="empty"><strong>No shops linked yet</strong>Create your CreditBook account once, then enter the access code from each shop above. The code is not needed again after that shop is linked.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Shop</th><th>Customer name</th><th>Outstanding</th><th></th></tr></thead><tbody>
          {rows.map(customer => <tr key={customer.id}><td><strong>{customer.storeName}</strong></td><td>{customer.name}</td><td className="amount">{formatINR(customer.balance)}</td><td><Link href={`/account/${customer.id}`} className="btn secondary small">View ledger</Link></td></tr>)}
        </tbody></table></div>}
      </section>
    </main>
  </>;
}
