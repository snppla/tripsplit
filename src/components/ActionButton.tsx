"use client";

import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action";

/** Runs a server action on click and shows its result next to the button. */
export function ActionButton({
  action,
  children,
  pendingText,
  className = "btn-secondary btn-sm",
}: {
  action: () => Promise<ActionState>;
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionState>();
  return (
    <span className="flex items-center gap-2">
      {result?.error && <span className="text-xs text-red-600 dark:text-red-400">{result.error}</span>}
      {result?.ok && <span className="text-xs text-brand-600">{result.ok} ✓</span>}
      <button
        type="button"
        className={`${className} shrink-0`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(undefined);
            setResult(await action());
          })
        }
      >
        {pending && pendingText ? pendingText : children}
      </button>
    </span>
  );
}
