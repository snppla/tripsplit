import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { expenses, tripEvents, users } from "@/db/schema";
import { deleteExpense } from "@/app/actions/expenses";
import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { minorToInput } from "@/lib/money";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ExpenseForm } from "@/components/ExpenseForm";
import { HistoryList } from "@/components/HistoryList";

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
  const { members, splits } = await loadTripData(tripId);
  const history = await db.query.tripEvents.findMany({
    where: and(eq(tripEvents.tripId, tripId), eq(tripEvents.entityId, expense.id)),
    orderBy: [desc(tripEvents.createdAt)],
  });
  const mySplits = splits.filter((s) => s.expenseId === expense.id);
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
