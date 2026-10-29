"use client";

import { useActionState } from "react";
import type { Trip } from "@/db/schema";
import type { ActionState } from "@/lib/action";
import { CurrencySelect } from "./CurrencySelect";
import { SubmitButton } from "./SubmitButton";

export function TripForm({
  action,
  trip,
  submitLabel,
  currencyLocked,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  trip?: Trip;
  submitLabel: string;
  currencyLocked?: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Trip name</label>
        <input id="name" name="name" className="input" required defaultValue={trip?.name} placeholder="Lisbon 2027" />
      </div>
      <div>
        <label className="label" htmlFor="description">Description <span className="muted font-normal">(optional)</span></label>
        <textarea id="description" name="description" rows={2} className="input" defaultValue={trip?.description ?? ""} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="startDate">Starts</label>
          <input id="startDate" name="startDate" type="date" className="input" defaultValue={trip?.startDate ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="endDate">Ends</label>
          <input id="endDate" name="endDate" type="date" className="input" defaultValue={trip?.endDate ?? ""} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="baseCurrency">Settle-up currency</label>
        <CurrencySelect id="baseCurrency" name="baseCurrency" defaultValue={trip?.baseCurrency ?? "USD"} disabled={currencyLocked} />
        {currencyLocked && <input type="hidden" name="baseCurrency" value={trip?.baseCurrency} />}
        <p className="muted mt-1 text-xs">
          {currencyLocked
            ? "Locked because expenses have been added."
            : "Expenses can be in any currency; balances are worked out in this one."}
        </p>
      </div>
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <SubmitButton pendingText="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
