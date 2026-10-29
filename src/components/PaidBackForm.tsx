"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/lib/action";
import { minorToInput } from "@/lib/money";
import { AmountInput } from "./AmountInput";
import { SubmitButton } from "./SubmitButton";

/** Records that one person paid back (some of) their share of an expense. */
export function PaidBackForm({
  action,
  expenseId,
  fromMemberId,
  toMemberId,
  remaining,
  currency,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  expenseId: string;
  fromMemberId: string;
  toMemberId: string;
  remaining: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(action, undefined);
  const [date, setDate] = useState("");
  useEffect(() => setDate(new Date().toLocaleDateString("en-CA")), []);
  useEffect(() => {
    if (state?.ok) setOpen(false);
  }, [state]);

  if (!open) {
    return (
      <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>
        Mark paid back
      </button>
    );
  }
  return (
    <form action={formAction} className="mt-2 w-full space-y-2">
      <input type="hidden" name="expenseId" value={expenseId} />
      <input type="hidden" name="from" value={fromMemberId} />
      <input type="hidden" name="to" value={toMemberId} />
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs">
          <span className="muted mb-1 block">Amount ({currency})</span>
          <AmountInput
            name="amount"
            currency={currency}
            defaultValue={minorToInput(remaining, currency)}
            className="input py-1.5! tabular-nums"
            required
          />
        </label>
        <label className="text-xs">
          <span className="muted mb-1 block">Paid on</span>
          <input name="date" type="date" className="input py-1.5!" required value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      <div className="flex gap-2">
        <SubmitButton className="btn-primary btn-sm" pendingText="Saving…">Save</SubmitButton>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
