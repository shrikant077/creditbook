import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatINR } from "@/lib/money";
import { AddCustomerForm } from "@/components/add-customer-form";
import { LogoutButton } from "@/components/logout-button";
import { CreateStoreForm } from "@/components/create-store-form";

export default async function DashboardPage() {
  const { supabase, user } = await requireUser();
  const { data: store } = await supabase.from("stores").select("id,name").eq("owner_id", user.id).maybeSingle();

  if (!store) {
    return <main className="shell page"><div className="page-head"><div><div className="eyebrow">Store setup</div><h1>Create your store</h1><p>Set up the business account to start tracking customer credit.</p></div><LogoutButton /></div>
      <div className="panel" style={{ maxWidth: 520 }}><CreateStoreForm /></div>
    </main>;
  }

  const { data: customers } = await supabase.from("customers")
    .select("id,name,email,phone_e164,created_at,user_id")
    .eq("store_id", store.id).order("created_at", { ascending: false });
  const rows = await Promise.all((customers ?? []).map(async (customer) => {
    const { data: balance } = await supabase.rpc("get_customer_balance", { p_customer_id: customer.id });
    return { ...customer, balance: Number(balance ?? 0) };
  }));
  const totalOutstanding = rows.reduce((sum, customer) => sum + customer.balance, 0);
  const owingCustomers = rows.filter(customer => customer.balance > 0).length;

  return <>
    <header className="topbar"><div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}><Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link><nav className="nav"><span className="muted text-small hide-mobile">{store.name}</span><LogoutButton /></nav></div></header>
    <main className="shell page">
      <div className="page-head"><div><div className="eyebrow">Store dashboard</div><h1>{store.name}</h1><p>Manage customer credit and incoming payments.</p></div><span className="pill">Store owner</span></div>
      <div className="stats">
        <div className="stat"><span>Total outstanding</span><strong>{formatINR(totalOutstanding)}</strong></div>
        <div className="stat"><span>Customers</span><strong>{rows.length}</strong></div>
        <div className="stat"><span>Customers with dues</span><strong>{owingCustomers}</strong></div>
      </div>
      <section className="panel"><div className="panel-head"><div><h2>Add a customer</h2><p className="muted text-small">Register their email and phone number. They will verify their email and use the access code to link their account.</p></div></div><AddCustomerForm storeId={store.id} /></section>
      <section className="panel"><div className="panel-head"><div><h2>Customers</h2><p className="muted text-small">Select a customer to view their ledger and add credit.</p></div><span className="pill">{rows.length} total</span></div>
        {rows.length === 0 ? <div className="empty"><strong>No customers yet</strong>Add your first customer using the form above.</div> : <div className="table-wrap"><table className="table"><thead><tr><th>Customer</th><th>Email</th><th>Phone</th><th>Account</th><th>Outstanding</th><th></th></tr></thead><tbody>
          {rows.map(customer => <tr key={customer.id}><td><Link className="customer-link" href={`/dashboard/customers/${customer.id}`}>{customer.name}</Link></td><td>{customer.email ?? "—"}</td><td>{customer.phone_e164}</td><td>{customer.user_id ? <span className="pill">Linked</span> : <span className="muted text-small">Not claimed</span>}</td><td className="amount">{formatINR(customer.balance)}</td><td><Link href={`/dashboard/customers/${customer.id}`} className="btn secondary small">Open</Link></td></tr>)}
        </tbody></table></div>}
      </section>
    </main>
  </>;
}
