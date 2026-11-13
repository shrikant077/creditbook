import Link from "next/link";

export default function HomePage() {
  return <>
    <header className="topbar"><div className="shell" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
      <Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link>
      <nav className="nav"><Link href="/login" className="muted hide-mobile">Customer login</Link><Link href="/login" className="btn small">Get started</Link></nav>
    </div></header>
    <main className="shell">
      <section className="hero">
        <div>
          <div className="eyebrow">A simpler way to manage store credit</div>
          <h1>Every credit.<br/><span style={{ color: "var(--green)" }}>Clearly tracked.</span></h1>
          <p>Keep customer dues organised, record what was purchased, and let customers check and settle their balance whenever they want.</p>
          <div className="hero-actions"><Link href="/login" className="btn">Create your store <span aria-hidden="true">→</span></Link><Link href="/login" className="btn secondary">Customer sign in</Link></div>
          <p className="text-small" style={{ marginTop: 18 }}>Built for neighbourhood shops, grocery stores and independent retailers.</p>
        </div>
        <div className="preview" aria-label="Illustrative credit dashboard preview">
          <div className="preview-head"><div><div className="eyebrow">Store overview</div><strong>Sharma General Store</strong></div><span className="pill">Today</span></div>
          <div className="preview-balance"><span className="muted text-small">Total outstanding</span><strong>₹24,850.00</strong><span className="muted text-small">Across 18 customers</span></div>
          <div style={{ marginTop: 12 }}>
            <div className="preview-row"><span><strong>Priya Das</strong><br/><span className="muted text-small">Rice, oil and groceries</span></span><strong>₹1,250</strong></div>
            <div className="preview-row"><span><strong>Arjun Roy</strong><br/><span className="muted text-small">Household supplies</span></span><strong>₹840</strong></div>
            <div className="preview-row"><span><strong>Meera Singh</strong><br/><span className="muted text-small">Monthly provisions</span></span><strong>₹2,100</strong></div>
          </div>
        </div>
      </section>
      <section className="section">
        <div className="eyebrow">Two sides, one ledger</div><h2>Designed for both the shop and the customer.</h2>
        <div className="feature-grid">
          <article className="feature"><div className="feature-icon">▦</div><h3>Store dashboard</h3><p>Add customers, record purchases on credit, see who owes what, and record cash or UPI payments received at the counter.</p></article>
          <article className="feature"><div className="feature-icon">◉</div><h3>Customer portal</h3><p>Customers can sign in with their phone, view itemised transactions and see their current outstanding balance.</p></article>
          <article className="feature"><div className="feature-icon">↗</div><h3>Online settlement</h3><p>Customers can pay all or part of their dues online. Payments are verified by the server before the ledger changes.</p></article>
        </div>
      </section>
    </main>
    <footer className="footer"><div className="shell" style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><span>© {new Date().getFullYear()} CreditBook</span><span>Clear records. Better relationships.</span></div></footer>
  </>;
}
