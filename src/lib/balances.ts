export type MemberBalance = {
  memberId: string;
  /** Total this member paid for group expenses. */
  paid: number;
  /** This member's share of group expenses. */
  share: number;
  /** Settlement payments this member made to others. */
  settledOut: number;
  /** Settlement payments this member received. */
  settledIn: number;
  /** Positive: the group owes this member. Negative: this member owes. */
  net: number;
};

export type Transfer = { from: string; to: string; amount: number };

type ExpenseLike = { paidById: string; baseAmount: number };
type SplitLike = { memberId: string; baseAmount: number };
type SettlementLike = { fromMemberId: string; toMemberId: string; amount: number };

export function computeBalances(
  memberIds: string[],
  expenses: ExpenseLike[],
  splits: SplitLike[],
  settlements: SettlementLike[],
): MemberBalance[] {
  const map = new Map<string, MemberBalance>(
    memberIds.map((memberId) => [
      memberId,
      { memberId, paid: 0, share: 0, settledOut: 0, settledIn: 0, net: 0 },
    ]),
  );
  const get = (id: string) => {
    let b = map.get(id);
    if (!b) {
      b = { memberId: id, paid: 0, share: 0, settledOut: 0, settledIn: 0, net: 0 };
      map.set(id, b);
    }
    return b;
  };
  for (const e of expenses) get(e.paidById).paid += e.baseAmount;
  for (const s of splits) get(s.memberId).share += s.baseAmount;
  for (const s of settlements) {
    get(s.fromMemberId).settledOut += s.amount;
    get(s.toMemberId).settledIn += s.amount;
  }
  for (const b of map.values()) b.net = b.paid - b.share + b.settledOut - b.settledIn;
  return [...map.values()];
}

/**
 * Greedy settle-up: repeatedly has the biggest debtor pay the biggest
 * creditor. Produces at most n-1 transfers.
 */
export function suggestTransfers(balances: Pick<MemberBalance, "memberId" | "net">[]): Transfer[] {
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.memberId, amt: b.net }));
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.memberId, amt: -b.net }));
  const transfers: Transfer[] = [];
  const byAmount = (a: { amt: number }, b: { amt: number }) => b.amt - a.amt;
  creditors.sort(byAmount);
  debtors.sort(byAmount);
  while (creditors.length && debtors.length) {
    const c = creditors[0];
    const d = debtors[0];
    const amount = Math.min(c.amt, d.amt);
    transfers.push({ from: d.id, to: c.id, amount });
    c.amt -= amount;
    d.amt -= amount;
    if (c.amt === 0) creditors.shift();
    if (d.amt === 0) debtors.shift();
    creditors.sort(byAmount);
    debtors.sort(byAmount);
  }
  return transfers;
}
