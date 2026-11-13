"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="shell page"><div className="panel" style={{ maxWidth: 560, margin: "80px auto", textAlign: "center" }}><div className="eyebrow">Something went wrong</div><h1 style={{ fontFamily: "Manrope", fontSize: 32 }}>We couldn't load this page.</h1><p className="muted">Please try again. If the problem continues, contact the site administrator.</p><button className="btn" onClick={() => reset()}>Try again</button></div></main>;
}
