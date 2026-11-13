import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CreditBook — Store credit, made clear",
  description: "A simple and secure credit ledger for local stores and their customers."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
