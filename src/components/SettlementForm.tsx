"use client";

import { useActionState } from "react";
import type { ActionState } from "@/lib/action";
import { AmountInput } from "./AmountInput";
import { SubmitButton } from "./SubmitButton";

export function SettlementForm({
  action,
  members,
  currency,
  defaultFrom,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  members: { id: string; name: string }[];
  currency: string;
  defaultFrom: string;
}) {
  const [state, formAction] = useActionState(action, undefined);
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
          <select id="to" name="to" className="input" defaultValue={members.find((m) => m.id !== defaultFrom)?.id}>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="amount">Amount ({currency})</label>
          <AmountInput id="amount" name="amount" currency={currency} className="input tabular-nums" required />
        </div>
        <div>
          <label className="label" htmlFor="note">Note</label>
          <input id="note" name="note" className="input" placeholder="Venmo" />
        </div>
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <SubmitButton className="btn-secondary" pendingText="Saving…">Record payment</SubmitButton>
    </form>
  );
}
