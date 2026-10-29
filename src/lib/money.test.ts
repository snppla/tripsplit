import { describe, expect, it } from "vitest";
import { allocate, amountError, convertToBase, formatMoney, minorToInput, parseAmount, sanitizeAmountInput } from "./money";

describe("parseAmount", () => {
  it("parses decimals into minor units", () => {
    expect(parseAmount("12.5", "USD")).toBe(1250);
    expect(parseAmount("1,200.07", "USD")).toBe(120007);
    expect(parseAmount(".5", "EUR")).toBe(50);
    expect(parseAmount("3000", "JPY")).toBe(3000);
  });
  it("rejects bad input", () => {
    expect(parseAmount("abc", "USD")).toBeNull();
    expect(parseAmount("1.234", "USD")).toBeNull();
    expect(parseAmount("10.5", "JPY")).toBeNull();
    expect(parseAmount("-5", "USD")).toBeNull();
  });
});

describe("formatting", () => {
  it("round-trips through input strings", () => {
    expect(minorToInput(1250, "USD")).toBe("12.50");
    expect(minorToInput(3000, "JPY")).toBe("3000");
    expect(formatMoney(123456, "USD")).toBe("$1,234.56");
  });
});

describe("convertToBase", () => {
  it("handles differing minor-unit digits", () => {
    expect(convertToBase(1000, "EUR", 1.1, "USD")).toBe(1100); // €10 -> $11
    expect(convertToBase(3000, "JPY", 0.0067, "USD")).toBe(2010); // ¥3000 -> $20.10
    expect(convertToBase(2000, "USD", 150, "JPY")).toBe(3000); // $20 -> ¥3000
  });
});

describe("allocate", () => {
  it("splits evenly with remainders distributed", () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(allocate(100, [1, 1])).toEqual([50, 50]);
  });
  it("respects weights and always sums to total", () => {
    const parts = allocate(1001, [2, 1, 1]);
    expect(parts.reduce((a, b) => a + b)).toBe(1001);
    expect(parts).toEqual([501, 250, 250]);
  });
  it("handles large exact-amount weights without overflow", () => {
    const parts = allocate(9_000_000_000, [4_000_000_000, 5_000_000_000]);
    expect(parts).toEqual([4_000_000_000, 5_000_000_000]);
  });
});

describe("sanitizeAmountInput", () => {
  it("drops decimals beyond the currency's precision", () => {
    expect(sanitizeAmountInput("16.234343", "USD")).toBe("16.23");
    expect(sanitizeAmountInput("16.2", "USD")).toBe("16.2");
    expect(sanitizeAmountInput("16.", "USD")).toBe("16.");
    expect(sanitizeAmountInput("300.5", "JPY")).toBe("300");
  });
  it("strips separators and rejects non-numbers", () => {
    expect(sanitizeAmountInput("1,200.50", "USD")).toBe("1200.50");
    expect(sanitizeAmountInput("12a", "USD")).toBeNull();
    expect(sanitizeAmountInput("1.2.3", "USD")).toBeNull();
    expect(sanitizeAmountInput("-5", "USD")).toBeNull();
  });
});

describe("amountError", () => {
  it("explains what's wrong", () => {
    expect(amountError("16.234343", "USD")).toBe("USD amounts can have at most 2 decimal places.");
    expect(amountError("12.5", "JPY")).toBe("JPY amounts can't have decimals.");
    expect(amountError("0", "USD")).toBe("Enter an amount greater than zero.");
    expect(amountError("", "USD")).toBe("Enter an amount.");
    expect(amountError("abc", "USD")).toBe("Enter a number, like 12.50.");
    expect(amountError("16.23", "USD")).toBeNull();
  });
  it("allows zero or blank when asked", () => {
    expect(amountError("", "USD", { allowZero: true })).toBeNull();
    expect(amountError("0", "USD", { allowZero: true })).toBeNull();
  });
});
