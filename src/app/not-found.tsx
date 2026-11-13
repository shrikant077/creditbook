import Link from "next/link";

export default function NotFound() {
  return <main className="shell page"><div className="panel" style={{ maxWidth: 560, margin: "80px auto", textAlign: "center" }}><div className="eyebrow">404 · Not found</div><h1 style={{ fontFamily: "Manrope", fontSize: 32 }}>This page isn't available.</h1><p className="muted">The record may not exist, or you may not have permission to view it.</p><Link href="/" className="btn">Go home</Link></div></main>;
}
