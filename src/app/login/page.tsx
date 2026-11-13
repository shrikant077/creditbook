import { AuthPanel } from "@/components/auth-panel";
import Link from "next/link";

export default function LoginPage() {
  return <><header className="topbar"><div className="shell" style={{ width: "100%" }}><Link href="/" className="brand"><span className="brand-mark">C</span> CreditBook</Link></div></header><AuthPanel /></>;
}
