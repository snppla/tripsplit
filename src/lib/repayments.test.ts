import { describe, expect, it } from "vitest";
import { repaidByExpense, repaidKey } from "./repayments";

describe("repaidByExpense", () => {
  it("sums linked payments to the payer and ignores the rest", () => {
    const repaid = repaidByExpense(
      [{ id: "cabin", paidById: "seth" }],
      [
        { expenseId: "cabin", fromMemberId: "josh", toMemberId: "seth", amount: 15000 },
        { expenseId: "cabin", fromMemberId: "josh", toMemberId: "seth", amount: 10000 },
        { expenseId: "cabin", fromMemberId: "peter", toMemberId: "josh", amount: 500 }, // not to the payer
        { expenseId: null, fromMemberId: "peter", toMemberId: "seth", amount: 999 }, // not linked
      ],
    );
    expect(repaid.get(repaidKey("cabin", "josh"))).toBe(25000);
    expect(repaid.get(repaidKey("cabin", "peter"))).toBeUndefined();
  });
});
