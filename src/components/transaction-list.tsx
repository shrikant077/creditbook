import { formatINR } from "@/lib/money";

type Credit = { id: string; description: string; amount_paise: number; created_at: string };
type Payment = { id: string; amount_paise: number; method: string; status: string; created_at: string };

export function TransactionList({ credits, payments }: { credits: Credit[]; payments: Payment[] }) {
  const rows = [
    ...credits.map(item => ({ id: item.id, kind: "credit" as const, title: item.description, amount: Number(item.amount_paise), date: item.created_at, meta: "Credit added" })),
    ...payments.map(item => ({ id: item.id, kind: "payment" as const, captured: item.status === "captured", title: `${item.method === "razorpay" ? "Online payment" : item.method.replace("_", " ")} · ${item.status}`, amount: Number(item.amount_paise), date: item.created_at, meta: item.status === "captured" ? "Payment received" : item.status === "pending" ? "Awaiting confirmation" : "Not applied to balance" }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!rows.length) return <div className="empty"><strong>No transactions yet</strong>Credits and payments will appear here.</div>;
  return <div>{rows.map(row => <div className="ledger-item" key={`${row.kind}-${row.id}`}>
    <div><div className="ledger-title">{row.title}</div><div className="ledger-meta">{new Date(row.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })} · {row.meta}</div></div>
    <div className={`ledger-amount ${row.kind === "credit" ? "positive" : row.captured ? "negative" : "muted"}`}>{row.kind === "credit" ? "+" : row.captured ? "−" : ""}{formatINR(row.amount)}</div>
  </div>)}</div>;
}
