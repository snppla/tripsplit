import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { ExpenseForm } from "@/components/ExpenseForm";

export default async function NewExpensePage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { trip, member: me } = await requireMember(tripId);
  const { members, expenses } = await loadTripData(tripId);

  // Default to the currency used most recently, since that's usually where you are.
  const currency = expenses[0]?.currency ?? trip.baseCurrency;
  const lastRate = expenses.find((e) => e.currency === currency)?.exchangeRate ?? "1";

  return (
    <div className="card p-5">
      <h2 className="mb-5 text-lg font-semibold">New expense</h2>
      <ExpenseForm
        tripId={tripId}
        expenseId={null}
        baseCurrency={trip.baseCurrency}
        members={members.map((m) => ({ id: m.id, name: m.id === me.id ? `${m.name} (you)` : m.name }))}
        initial={{
          description: "",
          category: "",
          notes: "",
          date: "",
          amount: "",
          currency,
          exchangeRate: String(Number(lastRate)),
          paidById: me.id,
          splitType: "equal",
          splits: Object.fromEntries(members.map((m) => [m.id, ""])),
        }}
      />
    </div>
  );
}
