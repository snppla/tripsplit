"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/action";
import { AmountInput } from "./AmountInput";
import { SubmitButton } from "./SubmitButton";

export function SettlementForm({
  action,
  members,
  expenses,
  currency,
  defaultFrom,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  members: { id: string; name: string }[];
  /** Expenses a payment can be linked to; picking one fills in who it's to. */
  expenses: { id: string; label: string; paidById: string }[];
  currency: string;
  defaultFrom: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const [to, setTo] = useState(members.find((m) => m.id !== defaultFrom)?.id ?? "");
  const [date, setDate] = useState("");
  // Bumped after each successful save to clear the amount and note.
  const [resetKey, setResetKey] = useState(0);
  useEffect(() => {
    if (state?.ok) setResetKey((k) => k + 1);
  }, [state]);
  // The user's local date; the server doesn't know their timezone.
  useEffect(() => setDate(new Date().toLocaleDateString("en-CA")), []);

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="from">From</label>
          <select id="from" name="from" className="input" defaultValue={defaultFrom}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="to">To</label>
          <select id="to" name="to" className="input" value={to} onChange={(e) => setTo(e.target.value)}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label" htmlFor="expenseId">For <span className="muted font-normal">(optional)</span></label>
        <select
          id="expenseId"
          name="expenseId"
          className="input"
          defaultValue=""
          onChange={(e) => {
            const payer = expenses.find((x) => x.id === e.target.value)?.paidById;
            if (payer) setTo(payer);
          }}
        >
          <option value="">General payment</option>
          {expenses.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">Amount ({currency})</label>
          <AmountInput key={resetKey} id="amount" name="amount" currency={currency} className="input tabular-nums" required />
        </div>
        <div>
          <label className="label" htmlFor="date">Paid on</label>
          <input id="date" name="date" type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="note">Note</label>
        <input key={resetKey} id="note" name="note" className="input" placeholder="Venmo" />
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <SubmitButton className="btn-secondary" pendingText="Saving…">Record payment</SubmitButton>
    </form>
  );
}
