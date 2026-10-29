import Link from "next/link";
import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/format";
import { categoryIcon } from "@/lib/categories";
import { repaidByExpense, repaidKey } from "@/lib/repayments";

export default async function ExpensesPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ person?: string }>;
}) {
  const { tripId } = await params;
  const { trip, member: me } = await requireMember(tripId);
  const { members, expenses, splits, settlements, balances } = await loadTripData(tripId);

  // Optional per-person view: only what this member paid for or is part of.
  const { person: personId } = await searchParams;
  const person = members.find((m) => m.id === personId);

  const nameOf = new Map(members.map((m) => [m.id, m.id === me.id ? "You" : m.name]));
  const focusId = person?.id ?? me.id;
  const shareOf = new Map(splits.filter((s) => s.memberId === focusId).map((s) => [s.expenseId, s.baseAmount]));
  const total = expenses.reduce((a, e) => a + e.baseAmount, 0);
  const mine = balances.find((b) => b.memberId === me.id);
  const money = (n: number) => formatMoney(n, trip.baseCurrency);

  const repaid = repaidByExpense(expenses, settlements);
  const descriptionOf = new Map(expenses.map((e) => [e.id, e.description]));

  const shown = person ? expenses.filter((e) => e.paidById === person.id || shareOf.has(e.id)) : expenses;
  const possessive = !person || person.id === me.id ? "your" : `${person.name}'s`;

  // Group by date for display.
  const groups = new Map<string, typeof expenses>();
  for (const e of shown) groups.set(e.date, [...(groups.get(e.date) ?? []), e]);

  return (
    <div className="space-y-5">
      <nav aria-label="Show expenses for" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <PersonChip href={`/trips/${tripId}`} active={!person} label="Everyone" />
        {members.map((m) => (
          <PersonChip
            key={m.id}
            href={`/trips/${tripId}?person=${m.id}`}
            active={person?.id === m.id}
            label={m.id === me.id ? `${m.name} (you)` : m.name}
          />
        ))}
      </nav>

      {person ? (
        <PersonSummary
          name={nameOf.get(person.id)!}
          isMe={person.id === me.id}
          balance={balances.find((b) => b.memberId === person.id)!}
          money={money}
          balancesHref={`/trips/${tripId}/balances`}
        />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Group total" value={money(total)} />
          <Stat label="Your share" value={money(mine?.share ?? 0)} />
          <Stat
            label={(mine?.net ?? 0) >= 0 ? "You're owed" : "You owe"}
            value={money(Math.abs(mine?.net ?? 0))}
            tone={(mine?.net ?? 0) > 0 ? "good" : (mine?.net ?? 0) < 0 ? "bad" : undefined}
          />
        </div>
      )}

      <Link href={`/trips/${tripId}/expenses/new`} className="btn-primary w-full py-3">+ Add expense</Link>

      {shown.length === 0 ? (
        <div className="card p-8 text-center">
          {person ? (
            <p className="muted text-sm">{nameOf.get(person.id)} isn&apos;t part of any expenses yet.</p>
          ) : (
            <>
              <p className="font-medium">No expenses yet</p>
              <p className="muted mt-1 text-sm">Add the first one — flights, the rental, that dinner.</p>
            </>
          )}
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
                  const share = shareOf.get(e.id);
                  const paidBack =
                    share !== undefined &&
                    e.paidById !== focusId &&
                    (repaid.get(repaidKey(e.id, focusId)) ?? 0) >= share;
                  // How this expense moved the person's balance: what they paid minus their share.
                  const effect = person ? (e.paidById === person.id ? e.baseAmount : 0) - (share ?? 0) : 0;
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
                            {share !== undefined
                              ? ` · ${possessive} share ${money(share)}`
                              : person && ` · ${person.id === me.id ? "you're" : `${person.name} is`} not in the split`}
                            {paidBack && " · paid back ✓"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">{formatMoney(e.amount, e.currency)}</p>
                          {person ? (
                            <p
                              className={`text-xs tabular-nums ${
                                effect > 0 ? "text-brand-600" : effect < 0 ? "text-red-600 dark:text-red-400" : "muted"
                              }`}
                            >
                              {effect > 0 ? "+" : effect < 0 ? "−" : ""}
                              {money(Math.abs(effect))}
                            </p>
                          ) : (
                            e.currency !== trip.baseCurrency && (
                              <p className="muted text-xs tabular-nums">{money(e.baseAmount)}</p>
                            )
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

      {person && (
        <PersonPayments
          payments={settlements.filter((s) => s.fromMemberId === person.id || s.toMemberId === person.id)}
          nameOf={nameOf}
          descriptionOf={descriptionOf}
          money={money}
        />
      )}
    </div>
  );
}

function PersonChip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? "border-brand-600 bg-brand-600 text-white"
          : "border-stone-300 hover:border-brand-500 dark:border-stone-700"
      }`}
    >
      {label}
    </Link>
  );
}

function PersonSummary({
  name,
  isMe,
  balance: b,
  money,
  balancesHref,
}: {
  name: string;
  isMe: boolean;
  balance: { paid: number; share: number; settledOut: number; settledIn: number; net: number };
  money: (n: number) => string;
  balancesHref: string;
}) {
  const headline =
    b.net > 0
      ? `${name} ${isMe ? "are" : "is"} owed ${money(b.net)}`
      : b.net < 0
        ? `${name} ${isMe ? "owe" : "owes"} ${money(-b.net)}`
        : `${name} ${isMe ? "are" : "is"} all settled up`;
  return (
    <div className="card p-4">
      <p
        className={`text-lg font-semibold ${
          b.net > 0 ? "text-brand-600" : b.net < 0 ? "text-red-600 dark:text-red-400" : ""
        }`}
      >
        {headline}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="muted text-xs">Paid for the group</dt>
          <dd className="font-medium tabular-nums">{money(b.paid)}</dd>
        </div>
        <div>
          <dt className="muted text-xs">Share of expenses</dt>
          <dd className="font-medium tabular-nums">{money(b.share)}</dd>
        </div>
        {(b.settledOut > 0 || b.settledIn > 0) && (
          <>
            <div>
              <dt className="muted text-xs">Payments sent</dt>
              <dd className="font-medium tabular-nums">{money(b.settledOut)}</dd>
            </div>
            <div>
              <dt className="muted text-xs">Payments received</dt>
              <dd className="font-medium tabular-nums">{money(b.settledIn)}</dd>
            </div>
          </>
        )}
      </dl>
      <Link href={balancesHref} className="mt-3 inline-block text-sm text-brand-600 hover:underline">
        See how to settle up →
      </Link>
    </div>
  );
}

function PersonPayments({
  payments,
  nameOf,
  descriptionOf,
  money,
}: {
  payments: {
    id: string;
    fromMemberId: string;
    toMemberId: string;
    amount: number;
    date: string;
    note: string | null;
    expenseId: string | null;
  }[];
  nameOf: Map<string, string>;
  descriptionOf: Map<string, string>;
  money: (n: number) => string;
}) {
  if (payments.length === 0) return null;
  return (
    <section>
      <h2 className="muted mb-2 text-xs font-semibold uppercase tracking-wide">Payments</h2>
      <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
        {payments.map((s) => (
          <li key={s.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <strong>{nameOf.get(s.fromMemberId)}</strong> paid <strong>{nameOf.get(s.toMemberId)}</strong>
                {s.expenseId && descriptionOf.has(s.expenseId) && <> for {descriptionOf.get(s.expenseId)}</>}
              </p>
              <p className="muted text-xs">
                {formatDate(s.date)}
                {s.note && ` · ${s.note}`}
              </p>
            </div>
            <span className="font-semibold tabular-nums">{money(s.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
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
