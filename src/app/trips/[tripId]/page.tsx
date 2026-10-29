import Link from "next/link";
import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { categoryIcon } from "@/lib/categories";

export default async function ExpensesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { trip, member: me } = await requireMember(tripId);
  const { members, expenses, splits, balances } = await loadTripData(tripId);

  const nameOf = new Map(members.map((m) => [m.id, m.id === me.id ? "You" : m.name]));
  const myShareOf = new Map(splits.filter((s) => s.memberId === me.id).map((s) => [s.expenseId, s.baseAmount]));
  const total = expenses.reduce((a, e) => a + e.baseAmount, 0);
  const mine = balances.find((b) => b.memberId === me.id);
  const money = (n: number) => formatMoney(n, trip.baseCurrency);

  // Group by date for display.
  const groups = new Map<string, typeof expenses>();
  for (const e of expenses) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Group total" value={money(total)} />
        <Stat label="Your share" value={money(mine?.share ?? 0)} />
        <Stat
          label={(mine?.net ?? 0) >= 0 ? "You're owed" : "You owe"}
          value={money(Math.abs(mine?.net ?? 0))}
          tone={(mine?.net ?? 0) > 0 ? "good" : (mine?.net ?? 0) < 0 ? "bad" : undefined}
        />
      </div>

      <Link href={`/trips/${tripId}/expenses/new`} className="btn-primary w-full py-3">+ Add expense</Link>

      {expenses.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No expenses yet</p>
          <p className="muted mt-1 text-sm">Add the first one — flights, the rental, that dinner.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {[...groups].map(([date, items]) => (
            <section key={date}>
              <h2 className="muted mb-2 text-xs font-semibold uppercase tracking-wide">
                {formatDate(date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </h2>
              <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
                {items.map((e) => {
                  const myShare = myShareOf.get(e.id);
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/trips/${tripId}/expenses/${e.id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-stone-50 dark:hover:bg-stone-800/50"
                      >
                        <span className="text-xl">{categoryIcon(e.category)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{e.description}</p>
                          <p className="muted truncate text-xs">
                            {nameOf.get(e.paidById)} paid
                            {myShare !== undefined && ` · your share ${money(myShare)}`}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatMoney(e.amount, e.currency)}</p>
                          {e.currency !== trip.baseCurrency && (
                            <p className="muted text-xs tabular-nums">{money(e.baseAmount)}</p>
                          )}
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  const color = tone === "good" ? "text-brand-600" : tone === "bad" ? "text-red-600 dark:text-red-400" : "";
  return (
    <div className="card p-3">
      <p className="muted text-xs">{label}</p>
      <p className={`mt-1 truncate font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
