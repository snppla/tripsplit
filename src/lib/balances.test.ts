import { describe, expect, it } from "vitest";
import { computeBalances, suggestTransfers } from "./balances";

describe("balances", () => {
  it("computes net balances and a settle-up plan", () => {
    // A pays 90 split 3 ways; B pays 30 split between B and C.
    const balances = computeBalances(
      ["a", "b", "c"],
      [
        { paidById: "a", baseAmount: 9000 },
        { paidById: "b", baseAmount: 3000 },
      ],
      [
        { memberId: "a", baseAmount: 3000 },
        { memberId: "b", baseAmount: 3000 },
        { memberId: "c", baseAmount: 3000 },
        { memberId: "b", baseAmount: 1500 },
        { memberId: "c", baseAmount: 1500 },
      ],
      [],
    );
    const net = Object.fromEntries(balances.map((b) => [b.memberId, b.net]));
    expect(net).toEqual({ a: 6000, b: -1500, c: -4500 });
    expect(suggestTransfers(balances)).toEqual([
      { from: "c", to: "a", amount: 4500 },
      { from: "b", to: "a", amount: 1500 },
    ]);
  });

  it("accounts for recorded settlements", () => {
    const balances = computeBalances(
      ["a", "b"],
      [{ paidById: "a", baseAmount: 1000 }],
      [
        { memberId: "a", baseAmount: 500 },
        { memberId: "b", baseAmount: 500 },
      ],
      [{ fromMemberId: "b", toMemberId: "a", amount: 500 }],
    );
    expect(balances.every((b) => b.net === 0)).toBe(true);
    expect(suggestTransfers(balances)).toEqual([]);
  });
});
