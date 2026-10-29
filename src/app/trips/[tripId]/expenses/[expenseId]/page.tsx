import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { expenses, tripEvents, users } from "@/db/schema";
import { deleteExpense } from "@/app/actions/expenses";
import { recordSettlement } from "@/app/actions/settlements";
import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { formatMoney, minorToInput } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { repaidByExpense, repaidKey } from "@/lib/repayments";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ExpenseForm } from "@/components/ExpenseForm";
import { HistoryList } from "@/components/HistoryList";
import { PaidBackForm } from "@/components/PaidBackForm";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ tripId: string; expenseId: string }>;
}) {
  const { tripId, expenseId } = await params;
  const { trip, member: me } = await requireMember(tripId);
  const expense = await db.query.expenses.findFirst({
    where: and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)),
  });
  if (!expense) notFound();
  const { members, expenses: allExpenses, splits, settlements } = await loadTripData(tripId);
  const history = await db.query.tripEvents.findMany({
    where: and(eq(tripEvents.tripId, tripId), eq(tripEvents.entityId, expense.id)),
    orderBy: [desc(tripEvents.createdAt)],
  });
  const mySplits = splits.filter((s) => s.expenseId === expense.id);
  const nameOf = new Map(members.map((m) => [m.id, m.id === me.id ? "You" : m.name]));
  const money = (n: number) => formatMoney(n, trip.baseCurrency);

  // Everyone in the split except the payer owes the payer their share.
  const repaid = repaidByExpense(allExpenses, settlements);
  const linkedPayments = settlements.filter((s) => s.expenseId === expense.id);
  const owing = mySplits
    .filter((s) => s.memberId !== expense.paidById)
    .map((s) => ({ memberId: s.memberId, share: s.baseAmount, repaid: repaid.get(repaidKey(expense.id, s.memberId)) ?? 0 }));
  const recordAction = recordSettlement.bind(null, tripId);
  const creator = expense.createdById
    ? await db.query.users.findFirst({ where: eq(users.id, expense.createdById) })
    : undefined;

  const splitValue = (weight: number) =>
    expense.splitType === "exact"
      ? minorToInput(weight, expense.currency)
      : expense.splitType === "shares"
        ? String(weight)
        : "";

  return (
    <div className="space-y-6">
      {owing.length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold">Paid back to {nameOf.get(expense.paidById)}</h2>
          <p className="muted mt-0.5 text-xs">
            Record when someone pays {expense.paidById === me.id ? "you" : nameOf.get(expense.paidById)} back for
            this. It counts toward balances like any other payment.
          </p>
          <ul className="mt-3 divide-y divide-stone-100 dark:divide-stone-800">
            {owing.map((o) => {
              const done = o.repaid >= o.share;
              return (
                <li key={o.memberId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{nameOf.get(o.memberId)}</p>
                    <p className="muted text-xs tabular-nums">
                      Share {money(o.share)}
                      {o.repaid > 0 && !done && ` · ${money(o.repaid)} paid back so far`}
                    </p>
                  </div>
                  {done ? (
                    <span className="text-sm font-medium text-brand-600">Paid back ✓</span>
                  ) : (
                    <PaidBackForm
                      action={recordAction}
                      expenseId={expense.id}
                      fromMemberId={o.memberId}
                      toMemberId={expense.paidById}
                      remaining={o.share - o.repaid}
                      currency={trip.baseCurrency}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {linkedPayments.length > 0 && (
            <ul className="muted mt-2 space-y-0.5 border-t border-stone-100 pt-2 text-xs dark:border-stone-800">
              {linkedPayments.map((s) => (
                <li key={s.id}>
                  {nameOf.get(s.fromMemberId)} paid {nameOf.get(s.toMemberId)} {money(s.amount)} on {formatDate(s.date)}
                  {s.note && ` · ${s.note}`}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className="card p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Edit expense</h2>
            {creator && (
              <p className="muted text-xs">
                Added by {creator.name ?? creator.email} on {expense.createdAt.toLocaleDateString("en")}
              </p>
            )}
          </div>
          <ConfirmButton
            action={deleteExpense.bind(null, tripId, expense.id)}
            confirm={`Delete "${expense.description}"?`}
          >
            Delete
          </ConfirmButton>
        </div>
        <ExpenseForm
          tripId={tripId}
          expenseId={expense.id}
          baseCurrency={trip.baseCurrency}
          members={members.map((m) => ({ id: m.id, name: m.id === me.id ? `${m.name} (you)` : m.name }))}
          initial={{
            description: expense.description,
            category: expense.category ?? "",
            notes: expense.notes ?? "",
            date: expense.date,
            amount: minorToInput(expense.amount, expense.currency),
            currency: expense.currency,
            exchangeRate: String(Number(expense.exchangeRate)),
            paidById: expense.paidById,
            splitType: expense.splitType,
            splits: Object.fromEntries(mySplits.map((s) => [s.memberId, splitValue(s.weight)])),
          }}
        />
      </div>
      {history.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold">History</h2>
          <HistoryList
            tripId={tripId}
            baseCurrency={trip.baseCurrency}
            events={history}
            existingIds={new Set([expense.id])}
          />
        </section>
      )}
    </div>
  );
}
