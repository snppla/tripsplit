import Link from "next/link";
import type { TripEvent } from "@/db/schema";
import { restoreExpense } from "@/app/actions/expenses";
import { restoreSettlement } from "@/app/actions/settlements";
import {
  describeExpenseChanges,
  describeTripChanges,
  type Change,
  type ExpenseSnapshot,
  type MemberSnapshot,
  type SettlementSnapshot,
  type TripSnapshot,
} from "@/lib/history";
import { formatMoney } from "@/lib/money";
import { ConfirmButton } from "./ConfirmButton";

const ICONS = { created: "+", updated: "✎", deleted: "✕", restored: "↺" } as const;

export function HistoryList({
  tripId,
  baseCurrency,
  events,
  existingIds,
}: {
  tripId: string;
  baseCurrency: string;
  events: TripEvent[];
  /** Ids of expenses/payments that currently exist, to decide what can be restored. */
  existingIds: Set<string>;
}) {
  if (events.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="muted text-sm">No changes recorded yet.</p>
      </div>
    );
  }
  return (
    <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 px-4 py-3">
          <span
            className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
              e.action === "deleted"
                ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400"
                : "bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300"
            }`}
          >
            {ICONS[e.action]}
          </span>
          <div className="min-w-0 flex-1">
            <EventBody tripId={tripId} baseCurrency={baseCurrency} event={e} existingIds={existingIds} />
            <p className="muted mt-1 text-xs">
              {e.createdAt.toLocaleString("en", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function EventBody({
  tripId,
  baseCurrency,
  event: e,
  existingIds,
}: {
  tripId: string;
  baseCurrency: string;
  event: TripEvent;
  existingIds: Set<string>;
}) {
  const actor = <strong>{e.actorName}</strong>;

  if (e.entity === "expense") {
    const before = e.before as ExpenseSnapshot | null;
    const after = e.after as ExpenseSnapshot | null;
    const s = (after ?? before)!;
    const title = existingIds.has(e.entityId) ? (
      <Link href={`/trips/${tripId}/expenses/${e.entityId}`} className="font-semibold hover:underline">
        {s.description}
      </Link>
    ) : (
      <strong>{s.description}</strong>
    );
    const amount = <span className="tabular-nums"> · {formatMoney(s.amount, s.currency)}</span>;
    const restore = (label: string, confirm: string) => (
      <ConfirmButton
        action={restoreExpense.bind(null, tripId, e.id)}
        confirm={confirm}
        className="btn-secondary btn-sm mt-2"
      >
        {label}
      </ConfirmButton>
    );

    if (e.action === "created")
      return <p className="text-sm">{actor} added {title}{amount}</p>;
    if (e.action === "deleted")
      return (
        <>
          <p className="text-sm">{actor} deleted {title}{amount}</p>
          <p className="muted text-xs">Paid by {s.paidByName} · split with {s.splits.map((p) => p.name).join(", ")}</p>
          {!existingIds.has(e.entityId) && restore("Restore", `Restore "${s.description}"?`)}
        </>
      );
    if (e.action === "restored")
      return <p className="text-sm">{actor} restored {title}{amount}</p>;
    return (
      <>
        <p className="text-sm">{actor} edited {title}</p>
        {before && after && <ChangeList changes={describeExpenseChanges(before, after)} />}
        {before &&
          restore("Revert", `Put "${before.description}" back to how it was before this edit? Later edits will be overwritten (but still kept in history).`)}
      </>
    );
  }

  if (e.entity === "settlement") {
    const s = ((e.after ?? e.before) as SettlementSnapshot)!;
    const what = (
      <>
        <strong>{s.fromName}</strong> paid <strong>{s.toName}</strong>
        {s.note && ` (${s.note})`}
      </>
    );
    const verb = { created: "recorded", deleted: "deleted", restored: "restored", updated: "edited" }[e.action];
    return (
      <>
        <p className="text-sm">
          {actor} {verb} a payment: {what}
          <span className="tabular-nums"> · {formatMoney(s.amount, baseCurrency)}</span>
        </p>
        {e.action === "deleted" && !existingIds.has(e.entityId) && (
          <ConfirmButton
            action={restoreSettlement.bind(null, tripId, e.id)}
            confirm="Restore this payment?"
            className="btn-secondary btn-sm mt-2"
          >
            Restore
          </ConfirmButton>
        )}
      </>
    );
  }

  if (e.entity === "member") {
    const before = e.before as MemberSnapshot | null;
    const after = e.after as MemberSnapshot | null;
    if (e.action === "created")
      return after?.userId && e.actorUserId === after.userId ? (
        <p className="text-sm"><strong>{after.name}</strong> joined the trip</p>
      ) : (
        <p className="text-sm">{actor} added <strong>{after?.name}</strong>{after?.email && ` (${after.email})`}</p>
      );
    if (e.action === "deleted")
      return <p className="text-sm">{actor} removed <strong>{before?.name}</strong></p>;
    if (before && after && !before.userId && after.userId)
      return (
        <p className="text-sm">
          {actor} signed in and took the spot of <strong>{after.name}</strong>
          {after.email && ` (${after.email})`}
        </p>
      );
    return (
      <p className="text-sm">
        {actor} renamed <strong>{before?.name}</strong> to <strong>{after?.name}</strong>
      </p>
    );
  }

  // Trip settings
  const before = e.before as TripSnapshot | null;
  const after = e.after as TripSnapshot | null;
  return (
    <>
      <p className="text-sm">{actor} changed trip settings</p>
      {before && after && <ChangeList changes={describeTripChanges(before, after)} />}
    </>
  );
}

function ChangeList({ changes }: { changes: Change[] }) {
  if (changes.length === 0) return null;
  return (
    <dl className="mt-1.5 space-y-1 rounded-lg bg-stone-50 p-2 text-xs dark:bg-stone-800/50">
      {changes.map((c) => (
        <div key={c.field}>
          <dt className="inline font-medium">{c.field}: </dt>
          <dd className="inline">
            <span className="text-red-700 line-through decoration-red-300 dark:text-red-400">{c.from}</span>
            {" → "}
            <span className="text-brand-700 dark:text-brand-100">{c.to}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
