type ExpenseLike = { id: string; paidById: string };
type SettlementLike = { expenseId: string | null; fromMemberId: string; toMemberId: string; amount: number };

export const repaidKey = (expenseId: string, memberId: string) => `${expenseId}:${memberId}`;

/**
 * How much each member has paid back toward each expense, keyed by
 * repaidKey(expenseId, memberId). Only payments linked to the expense and
 * made to whoever paid for it count.
 */
export function repaidByExpense(expenses: ExpenseLike[], settlements: SettlementLike[]) {
  const payerOf = new Map(expenses.map((e) => [e.id, e.paidById]));
  const repaid = new Map<string, number>();
  for (const s of settlements) {
    if (!s.expenseId || payerOf.get(s.expenseId) !== s.toMemberId) continue;
    const key = repaidKey(s.expenseId, s.fromMemberId);
    repaid.set(key, (repaid.get(key) ?? 0) + s.amount);
  }
  return repaid;
}
