"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { lookupRate, saveExpense, type ExpenseInput } from "@/app/actions/expenses";
import { CATEGORIES } from "@/lib/categories";
import { allocate, amountError, convertToBase, formatMoney, parseAmount, sanitizeAmountInput } from "@/lib/money";
import { AmountInput } from "./AmountInput";
import { CurrencySelect } from "./CurrencySelect";

type Member = { id: string; name: string };
type SplitType = ExpenseInput["splitType"];

export type ExpenseFormInitial = {
  description: string;
  category: string;
  notes: string;
  date: string;
  amount: string;
  currency: string;
  exchangeRate: string;
  paidById: string;
  splitType: SplitType;
  /** memberId -> entered value; members absent from the map are excluded. */
  splits: Record<string, string>;
};

export function ExpenseForm({
  tripId,
  expenseId,
  baseCurrency,
  members,
  initial,
}: {
  tripId: string;
  expenseId: string | null;
  baseCurrency: string;
  members: Member[];
  initial: ExpenseFormInitial;
}) {
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [rateStatus, setRateStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof ExpenseFormInitial>(key: K, value: ExpenseFormInitial[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const foreign = f.currency !== baseCurrency;

  // New expenses default to today in the user's own timezone, which the
  // server doesn't know.
  useEffect(() => {
    if (!initial.date) setF((prev) => ({ ...prev, date: new Date().toLocaleDateString("en-CA") }));
  }, [initial.date]);

  // Fetch a suggested rate when the currency or date changes. Skip the very
  // first render when editing so the stored rate is kept.
  const skipFirstFetch = useRef(Boolean(expenseId));
  useEffect(() => {
    if (skipFirstFetch.current) {
      skipFirstFetch.current = false;
      return;
    }
    if (!foreign || !f.date) return;
    let cancelled = false;
    setRateStatus("loading");
    lookupRate(f.currency, baseCurrency, f.date).then((rate) => {
      if (cancelled) return;
      if (rate) {
        setF((prev) => ({ ...prev, exchangeRate: String(rate) }));
        setRateStatus("idle");
      } else {
        setRateStatus("failed");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [f.currency, f.date, foreign, baseCurrency]);

  const amountMinor = parseAmount(f.amount, f.currency);
  // Only nag once something's been typed; an empty field is caught on submit.
  const amountProblem = f.amount.trim() ? amountError(f.amount, f.currency) : null;
  const rate = foreign ? Number(f.exchangeRate) : 1;
  const baseMinor =
    amountMinor && rate > 0 ? convertToBase(amountMinor, f.currency, rate, baseCurrency) : null;

  const included = members.filter((m) => m.id in f.splits);

  // Preview of what each person owes, in the expense currency.
  const preview = (() => {
    const out = new Map<string, number>();
    if (!amountMinor) return out;
    const weights = included.map((m) => {
      if (f.splitType === "equal") return 1;
      if (f.splitType === "shares") return /^\d+$/.test(f.splits[m.id]) ? Number(f.splits[m.id]) : 0;
      return parseAmount(f.splits[m.id] || "0", f.currency) ?? 0;
    });
    if (f.splitType === "exact") {
      included.forEach((m, i) => out.set(m.id, weights[i]));
    } else if (weights.some((w) => w > 0)) {
      const parts = allocate(amountMinor, weights);
      included.forEach((m, i) => out.set(m.id, parts[i]));
    }
    return out;
  })();

  const exactRemaining =
    f.splitType === "exact" && amountMinor
      ? amountMinor - [...preview.values()].reduce((a, b) => a + b, 0)
      : 0;

  function toggleMember(id: string) {
    setF((prev) => {
      const splits = { ...prev.splits };
      if (id in splits) delete splits[id];
      else splits[id] = prev.splitType === "shares" ? "1" : "";
      return { ...prev, splits };
    });
  }

  function changeSplitType(splitType: SplitType) {
    setF((prev) => ({
      ...prev,
      splitType,
      splits: Object.fromEntries(
        Object.keys(prev.splits).map((id) => [id, splitType === "shares" ? "1" : ""]),
      ),
    }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveExpense(tripId, expenseId, {
        ...f,
        splits: included.map((m) => ({ memberId: m.id, value: f.splits[m.id] ?? "" })),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="label" htmlFor="description">What was it?</label>
        <input
          id="description"
          className="input"
          required
          autoFocus={!expenseId}
          placeholder="Dinner at Taberna"
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
        />
      </div>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <div>
          <label className="label" htmlFor="amount">Amount</label>
          <AmountInput
            id="amount"
            currency={f.currency}
            className={`input tabular-nums ${amountProblem ? "border-red-400!" : ""}`}
            required
            placeholder="0.00"
            aria-invalid={Boolean(amountProblem)}
            aria-describedby={amountProblem ? "amount-error" : undefined}
            value={f.amount}
            onValueChange={(v) => set("amount", v)}
          />
        </div>
        <div>
          <label className="label" htmlFor="currency">Currency</label>
          <CurrencySelect id="currency" value={f.currency} onChange={(e) => set("currency", e.target.value)} />
        </div>
      </div>
      {amountProblem && (
        <p id="amount-error" className="-mt-3 text-sm text-red-600 dark:text-red-400">{amountProblem}</p>
      )}

      {foreign && (
        <div className="rounded-xl bg-stone-100 p-3 dark:bg-stone-800/60">
          <label className="label" htmlFor="rate">
            Exchange rate: 1 {f.currency} = ? {baseCurrency}
          </label>
          <input
            id="rate"
            className="input tabular-nums"
            inputMode="decimal"
            required
            value={f.exchangeRate}
            onChange={(e) => {
              if (/^\d*\.?\d*$/.test(e.target.value)) set("exchangeRate", e.target.value);
            }}
          />
          <p className="muted mt-1.5 text-xs">
            {rateStatus === "loading" && "Looking up rate…"}
            {rateStatus === "failed" && "Couldn't look up a rate for this currency — enter it manually."}
            {rateStatus === "idle" && baseMinor !== null && <>≈ {formatMoney(baseMinor, baseCurrency)}. </>}
            {rateStatus === "idle" && "Adjust to match what your card actually charged."}
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="paidBy">Paid by</label>
          <select id="paidBy" className="input" value={f.paidById} onChange={(e) => set("paidById", e.target.value)}>
            {members.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="date">Date</label>
          <input id="date" type="date" className="input" required value={f.date} onChange={(e) => set("date", e.target.value)} />
        </div>
      </div>

      <fieldset className="min-w-0">
        <legend className="label">Split</legend>
        <div className="mb-3 flex gap-1 rounded-xl bg-stone-200/60 p-1 dark:bg-stone-800/60">
          {(
            [
              ["equal", "Equal"],
              ["shares", "Shares"],
              ["exact", "Exact"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => changeSplitType(type)}
              className={`flex-1 rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                f.splitType === type ? "bg-white shadow-sm dark:bg-stone-900" : "muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <ul className="card divide-y divide-stone-100 dark:divide-stone-800">
          {members.map((m) => {
            const on = m.id in f.splits;
            return (
              <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    className="size-5 shrink-0 accent-brand-600"
                    checked={on}
                    onChange={() => toggleMember(m.id)}
                  />
                  <span className={`truncate ${on ? "" : "muted"}`}>{m.name}</span>
                </label>
                {on && f.splitType !== "equal" && (
                  <input
                    aria-label={`${m.name} ${f.splitType === "shares" ? "shares" : "amount"}`}
                    className="input w-24! py-1.5! text-right tabular-nums"
                    inputMode={f.splitType === "shares" ? "numeric" : "decimal"}
                    placeholder={f.splitType === "shares" ? "1" : "0.00"}
                    value={f.splits[m.id]}
                    onChange={(e) => {
                      // Shares are whole numbers; exact amounts follow the currency's precision.
                      const raw = e.target.value;
                      const next =
                        f.splitType === "shares" ? (/^\d*$/.test(raw) ? raw : null) : sanitizeAmountInput(raw, f.currency);
                      if (next !== null) setF((prev) => ({ ...prev, splits: { ...prev.splits, [m.id]: next } }));
                    }}
                  />
                )}
                {on && f.splitType !== "exact" && (
                  <span className="muted w-20 text-right text-sm tabular-nums">
                    {preview.has(m.id) ? formatMoney(preview.get(m.id)!, f.currency) : "—"}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-2 flex justify-between text-xs">
          <button
            type="button"
            className="text-brand-600 hover:underline"
            onClick={() =>
              setF((prev) => ({
                ...prev,
                splits:
                  included.length === members.length
                    ? {}
                    : Object.fromEntries(
                        members.map((m) => [m.id, prev.splits[m.id] ?? (prev.splitType === "shares" ? "1" : "")]),
                      ),
              }))
            }
          >
            {included.length === members.length ? "Select none" : "Select everyone"}
          </button>
          {f.splitType === "exact" && amountMinor && (
            <span className={exactRemaining === 0 ? "text-brand-600" : "text-red-600 dark:text-red-400"}>
              {exactRemaining === 0
                ? "Adds up ✓"
                : `${formatMoney(Math.abs(exactRemaining), f.currency)} ${exactRemaining > 0 ? "left to assign" : "over"}`}
            </span>
          )}
        </div>
      </fieldset>

      <details className="group" open={Boolean(initial.category || initial.notes)}>
        <summary className="muted cursor-pointer text-sm">Category &amp; notes</summary>
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => set("category", f.category === c.id ? "" : c.id)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  f.category === c.id
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-700/20"
                    : "border-stone-300 dark:border-stone-700"
                }`}
              >
                {c.icon} {c.label}
              </button>
            ))}
          </div>
          <textarea
            className="input"
            rows={2}
            placeholder="Notes"
            value={f.notes}
            onChange={(e) => set("notes", e.target.value)}
          />
        </div>
      </details>

      {error && <p className="alert-error">{error}</p>}
      <button type="submit" className="btn-primary w-full py-3" disabled={pending}>
        {pending ? "Saving…" : expenseId ? "Save changes" : "Add expense"}
      </button>
    </form>
  );
}
