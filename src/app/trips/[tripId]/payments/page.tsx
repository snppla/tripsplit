import Link from "next/link";
import { deleteSettlement, recordSettlement } from "@/app/actions/settlements";
import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SettlementForm } from "@/components/SettlementForm";

export default async function PaymentsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { trip, member: me } = await requireMember(tripId);
  const { members, expenses, settlements } = await loadTripData(tripId);

  const money = (n: number) => formatMoney(n, trip.baseCurrency);
  const nameOf = new Map(members.map((m) => [m.id, m.id === me.id ? "You" : m.name]));
  const descriptionOf = new Map(expenses.map((e) => [e.id, e.description]));
  const total = settlements.reduce((a, s) => a + s.amount, 0);

  // Group by date for display (already sorted newest first).
  const groups = new Map<string, typeof settlements>();
  for (const s of settlements) groups.set(s.date, [...(groups.get(s.date) ?? []), s]);

  return (
    <div className="space-y-5">
      <p className="muted text-sm">
        Money people have paid each other directly, whether to pay someone back for an expense or to settle up. Payments
        count toward everyone&apos;s balance.
      </p>

      <details className="card p-4" open={settlements.length === 0}>
        <summary className="cursor-pointer font-medium">+ Record a payment</summary>
        <div className="mt-4">
          <SettlementForm
            action={recordSettlement.bind(null, tripId)}
            members={members.map((m) => ({ id: m.id, name: nameOf.get(m.id)! }))}
            expenses={expenses.map((e) => ({
              id: e.id,
              paidById: e.paidById,
              label: `${e.description} · ${formatMoney(e.amount, e.currency)}, paid by ${nameOf.get(e.paidById)}`,
            }))}
            currency={trip.baseCurrency}
            defaultFrom={me.id}
          />
        </div>
      </details>

      {settlements.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No payments yet</p>
          <p className="muted mt-1 text-sm">
            When someone pays someone back, record it here. Or use &ldquo;Mark paid&rdquo; on the{" "}
            <Link href={`/trips/${tripId}/balances`} className="text-brand-600 hover:underline">Balances</Link> tab.
          </p>
        </div>
      ) : (
        <>
          <p className="muted text-sm">
            {settlements.length} payment{settlements.length === 1 ? "" : "s"} · {money(total)} total
          </p>
          <div className="space-y-5">
            {[...groups].map(([date, items]) => (
              <section key={date}>
                <h2 className="muted mb-2 text-xs font-semibold uppercase tracking-wide">
                  {formatDate(date, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </h2>
                <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
                  {items.map((s) => (
                    <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm">
                          <strong>{nameOf.get(s.fromMemberId)}</strong> paid <strong>{nameOf.get(s.toMemberId)}</strong>
                        </p>
                        {(s.expenseId && descriptionOf.has(s.expenseId)) || s.note ? (
                          <p className="muted truncate text-xs">
                            {s.expenseId && descriptionOf.has(s.expenseId) && (
                              <>
                                for{" "}
                                <Link href={`/trips/${tripId}/expenses/${s.expenseId}`} className="hover:underline">
                                  {descriptionOf.get(s.expenseId)}
                                </Link>
                                {s.note && " · "}
                              </>
                            )}
                            {s.note}
                          </p>
                        ) : null}
                      </div>
                      <span className="font-semibold tabular-nums">{money(s.amount)}</span>
                      <ConfirmButton action={deleteSettlement.bind(null, tripId, s.id)} confirm="Delete this payment?">
                        ✕
                      </ConfirmButton>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
