"use client";

import { useTransition } from "react";

/** Runs a server action after a confirm() prompt. */
export function ConfirmButton({
  action,
  confirm: message,
  children,
  className = "btn-danger btn-sm",
}: {
  action: () => Promise<unknown>;
  confirm: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className={className}
      disabled={pending}
      onClick={() => {
        if (window.confirm(message)) start(async () => {
          const result = (await action()) as { error?: string } | undefined;
          if (result?.error) window.alert(result.error);
        });
      }}
    >
      {children}
    </button>
  );
}
