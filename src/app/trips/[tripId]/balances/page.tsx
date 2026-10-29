import { deleteSettlement, markTransferPaid, recordSettlement } from "@/app/actions/settlements";
import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { suggestTransfers } from "@/lib/balances";
import { formatMoney, minorToInput } from "@/lib/money";
import { formatDate, today } from "@/lib/format";
import { ConfirmButton } from "@/components/ConfirmButton";
import { SettlementForm } from "@/components/SettlementForm";
import { SubmitButton } from "@/components/SubmitButton";

export default async function BalancesPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { trip, member: me } = await requireMember(tripId);
  const { members, balances, settlements } = await loadTripData(tripId);

  const money = (n: number) => formatMoney(n, trip.baseCurrency);
  const nameOf = new Map(members.map((m) => [m.id, m.id === me.id ? "You" : m.name]));
  const transfers = suggestTransfers(balances);
  const maxAbs = Math.max(1, ...balances.map((b) => Math.abs(b.net)));
  const sorted = [...balances].sort((a, b) => b.net - a.net);
  const recordAction = recordSettlement.bind(null, tripId);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-2 font-semibold">Settle up</h2>
        {transfers.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="font-medium">Everyone is square 🎉</p>
          </div>
        ) : (
          <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
            {transfers.map((t) => (
              <li key={`${t.from}-${t.to}`} className="flex items-center gap-3 px-4 py-3">
                <p className="min-w-0 flex-1 text-sm">
                  <strong>{nameOf.get(t.from)}</strong> {t.from === me.id ? "pay" : "pays"}{" "}
                  <strong>{nameOf.get(t.to)}</strong>
                </p>
                <span className="font-semibold tabular-nums">{money(t.amount)}</span>
                <form action={markTransferPaid.bind(null, tripId)}>
                  <input type="hidden" name="from" value={t.from} />
                  <input type="hidden" name="to" value={t.to} />
                  <input type="hidden" name="amount" value={minorToInput(t.amount, trip.baseCurrency)} />
                  <input type="hidden" name="date" value={today()} />
                  <SubmitButton className="btn-secondary btn-sm" pendingText="…">Mark paid</SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <p className="muted mt-2 text-xs">
          The fewest payments needed to even everything out. &ldquo;Mark paid&rdquo; records the payment once it&apos;s made.
        </p>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Balances</h2>
        <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
          {sorted.map((b) => (
            <li key={b.memberId} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-medium">{nameOf.get(b.memberId)}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    b.net > 0 ? "text-brand-600" : b.net < 0 ? "text-red-600 dark:text-red-400" : "muted"
                  }`}
                >
                  {b.net > 0 ? "+" : b.net < 0 ? "−" : ""}
                  {money(Math.abs(b.net))}
                </span>
              </div>
              <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800">
                <div className="flex w-1/2 justify-end">
                  {b.net < 0 && (
                    <div className="h-full rounded-l-full bg-red-400" style={{ width: `${(-b.net / maxAbs) * 100}%` }} />
                  )}
                </div>
                <div className="w-1/2">
                  {b.net > 0 && (
                    <div className="h-full rounded-r-full bg-brand-500" style={{ width: `${(b.net / maxAbs) * 100}%` }} />
                  )}
                </div>
              </div>
              <p className="muted mt-1.5 text-xs">
                Paid {money(b.paid)} · Share {money(b.share)}
                {(b.settledOut > 0 || b.settledIn > 0) &&
                  ` · Sent ${money(b.settledOut)} · Received ${money(b.settledIn)}`}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Payments</h2>
        {settlements.length > 0 && (
          <ul className="card mb-3 divide-y divide-stone-100 dark:divide-stone-800">
            {settlements.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <strong>{nameOf.get(s.fromMemberId)}</strong> paid <strong>{nameOf.get(s.toMemberId)}</strong>
                  </p>
                  <p className="muted text-xs">
                    {formatDate(s.date)}
                    {s.note && ` · ${s.note}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">{money(s.amount)}</span>
                <ConfirmButton action={deleteSettlement.bind(null, tripId, s.id)} confirm="Delete this payment?">
                  ✕
                </ConfirmButton>
              </li>
            ))}
          </ul>
        )}
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-medium">Record a payment</summary>
          <div className="mt-4">
            <SettlementForm
              action={recordAction}
              members={members.map((m) => ({ id: m.id, name: nameOf.get(m.id)! }))}
              currency={trip.baseCurrency}
              defaultFrom={me.id}
            />
          </div>
        </details>
      </section>
    </div>
  );
}

