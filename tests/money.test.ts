import { describe, expect, it } from "vitest";
import { formatINR, rupeesToPaise } from "../src/lib/money";

describe("rupeesToPaise", () => {
  it("converts rupees to integer paise without floating point rounding", () => {
    expect(rupeesToPaise("10")).toBe(1000);
    expect(rupeesToPaise("10.5")).toBe(1050);
    expect(rupeesToPaise("10.05")).toBe(1005);
  });
  it("rejects invalid, zero and excessive precision values", () => {
    expect(() => rupeesToPaise("0")).toThrow();
    expect(() => rupeesToPaise("10.999")).toThrow();
    expect(() => rupeesToPaise("-10")).toThrow();
    expect(() => rupeesToPaise("abc")).toThrow();
  });
});

describe("formatINR", () => {
  it("formats paise as Indian rupees", () => {
    expect(formatINR(123456)).toContain("1,234.56");
  });
});
