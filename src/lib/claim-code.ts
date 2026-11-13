import "server-only";
import { createHmac, randomInt } from "node:crypto";

export function generateClaimCode(): string {
  return String(randomInt(10_000_000, 100_000_000));
}

export function hashClaimCode(email: string, code: string): string {
  const secret = process.env.CLAIM_CODE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CLAIM_CODE_SECRET must be configured with at least 32 characters.");
  }
  return createHmac("sha256", secret)
    .update(`${email.trim().toLowerCase()}:${code.trim()}`)
    .digest("hex");
}
