"use client";

import { useState } from "react";
import { currencyDigits, sanitizeAmountInput } from "@/lib/money";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange"> & {
  currency: string;
  /** Controlled value; omit to let the input manage its own state. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
};

/** A text input that only accepts amounts valid for `currency`. */
export function AmountInput({ currency, value, defaultValue = "", onValueChange, ...props }: Props) {
  const [own, setOwn] = useState(defaultValue);
  return (
    <input
      inputMode={currencyDigits(currency) === 0 ? "numeric" : "decimal"}
      autoComplete="off"
      {...props}
      value={value ?? own}
      onChange={(e) => {
        const next = sanitizeAmountInput(e.target.value, currency);
        if (next === null) return; // rejected: the input keeps its previous value
        if (onValueChange) onValueChange(next);
        else setOwn(next);
      }}
    />
  );
}
