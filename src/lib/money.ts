export function rupeesToPaise(value: string): number {
  const trimmed = value.trim();
  if (!/^\d{1,9}(?:\.\d{1,2})?$/.test(trimmed)) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }
  const [rupees, fraction = ""] = trimmed.split(".");
  const paise = Number(rupees) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(paise) || paise <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  return paise;
}

export function formatINR(amountPaise: number | string | null | undefined): string {
  const amount = Number(amountPaise ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format((Number.isFinite(amount) ? amount : 0) / 100);
}
