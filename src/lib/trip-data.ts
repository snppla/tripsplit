import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { expenseSplits, expenses, settlements, tripMembers } from "@/db/schema";
import { computeBalances } from "./balances";

export async function loadTripData(tripId: string) {
  const [members, expenseRows, splitRows, settlementRows] = await Promise.all([
    db.query.tripMembers.findMany({
      where: eq(tripMembers.tripId, tripId),
      orderBy: [asc(tripMembers.createdAt)],
    }),
    db.query.expenses.findMany({
      where: eq(expenses.tripId, tripId),
      orderBy: [desc(expenses.date), desc(expenses.createdAt)],
    }),
    db
      .select({ expenseId: expenseSplits.expenseId, memberId: expenseSplits.memberId, weight: expenseSplits.weight, baseAmount: expenseSplits.baseAmount })
      .from(expenseSplits)
      .innerJoin(expenses, eq(expenses.id, expenseSplits.expenseId))
      .where(eq(expenses.tripId, tripId)),
    db.query.settlements.findMany({
      where: eq(settlements.tripId, tripId),
      orderBy: [desc(settlements.date), desc(settlements.createdAt)],
    }),
  ]);
  const balances = computeBalances(
    members.map((m) => m.id),
    expenseRows,
    splitRows,
    settlementRows,
  );
  return { members, expenses: expenseRows, splits: splitRows, settlements: settlementRows, balances };
}
