"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/action";
import { SubmitButton } from "./SubmitButton";

export function AddMemberForm({
  action,
  emailEnabled,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  emailEnabled: boolean;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);
  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="m-name">Name</label>
          <input id="m-name" name="name" className="input" placeholder="Alex" />
        </div>
        <div>
          <label className="label" htmlFor="m-email">Google email <span className="muted font-normal">(optional)</span></label>
          <input id="m-email" name="email" type="email" className="input" placeholder="alex@gmail.com" />
        </div>
      </div>
      <p className="muted text-xs">
        {emailEnabled
          ? "With an email, we'll send them an invite and they'll be linked automatically when they sign in. "
          : "With an email, they'll be linked automatically when they sign in with that Google account. "}
        Without one, they&apos;re a placeholder you can still split costs with — they can claim the spot later via the invite link.
      </p>
      {state?.error && <p className="alert-error">{state.error}</p>}
      {state?.ok && <p className="alert-ok">{state.ok}</p>}
      <SubmitButton className="btn-secondary" pendingText="Adding…">Add person</SubmitButton>
    </form>
  );
}
