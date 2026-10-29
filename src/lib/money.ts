export const CURRENCIES = [
  "USD", "EUR", "GBP", "CAD", "AUD", "NZD", "JPY", "CNY", "HKD", "SGD", "KRW", "THB",
  "VND", "IDR", "PHP", "MYR", "INR", "MXN", "BRL", "ARS", "CLP", "COP", "PEN", "CRC",
  "CHF", "SEK", "NOK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON", "BGN", "TRY", "ILS",
  "AED", "ZAR", "MAD", "EGP",
] as const;

export function isCurrency(code: string): boolean {
  try {
    new Intl.NumberFormat("en", { style: "currency", currency: code });
    return /^[A-Z]{3}$/.test(code);
  } catch {
    return false;
  }
}

/** Number of minor-unit digits for a currency (2 for USD, 0 for JPY, ...). */
export function currencyDigits(currency: string): number {
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions()
    .maximumFractionDigits ?? 2;
}

/** Parses user input like "12.5" or "1,200.00" into minor units. */
export function parseAmount(input: string, currency: string): number | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d*)?$|^\.\d+$/.test(cleaned)) return null;
  const digits = currencyDigits(currency);
  const [whole, frac = ""] = cleaned.split(".");
  if (frac.length > digits) return null;
  const minor = Number(whole || "0") * 10 ** digits + Number(frac.padEnd(digits, "0") || "0");
  return Number.isSafeInteger(minor) ? minor : null;
}

/**
 * Filters what's typed or pasted into an amount field. Returns the cleaned
 * value, or null to reject the keystroke. Extra decimals beyond what the
 * currency allows are dropped (so typing them does nothing).
 */
export function sanitizeAmountInput(raw: string, currency: string): string | null {
  const cleaned = raw.replace(/[,\s]/g, "");
  if (!/^\d*\.?\d*$/.test(cleaned)) return null;
  const digits = currencyDigits(currency);
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  return digits === 0 ? cleaned.slice(0, dot) : cleaned.slice(0, dot + 1 + digits);
}

/**
 * Explains why `input` isn't a usable amount, or returns null if it is.
 * Pass `allowZero` for fields where 0 is meaningful (e.g. one person's
 * portion of an exact split).
 */
export function amountError(input: string, currency: string, { allowZero = false } = {}): string | null {
  const cleaned = input.replace(/[,\s]/g, "");
  if (cleaned === "") return allowZero ? null : "Enter an amount.";
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === ".") return "Enter a number, like 12.50.";
  const digits = currencyDigits(currency);
  const decimals = cleaned.split(".")[1]?.length ?? 0;
  if (decimals > digits) {
    return digits === 0
      ? `${currency} amounts can't have decimals.`
      : `${currency} amounts can have at most ${digits} decimal place${digits === 1 ? "" : "s"}.`;
  }
  const minor = parseAmount(cleaned, currency);
  if (minor === null) return "That amount is too large.";
  if (minor === 0 && !allowZero) return "Enter an amount greater than zero.";
  return null;
}

/** Formats minor units as a plain decimal string for form inputs. */
export function minorToInput(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

export function formatMoney(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(minor / 10 ** digits);
}

/**
 * Converts minor units of `currency` into minor units of `base`, where `rate`
 * is the number of base units per one unit of `currency`.
 */
export function convertToBase(amount: number, currency: string, rate: number, base: string): number {
  const shift = currencyDigits(base) - currencyDigits(currency);
  return Math.round(amount * rate * 10 ** shift);
}

/**
 * Splits `total` into integer parts proportional to `weights`, using the
 * largest-remainder method so the parts always sum to exactly `total`.
 */
export function allocate(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + BigInt(b), 0n);
  if (sum <= 0n) throw new Error("Weights must sum to a positive number");
  const t = BigInt(total);
  const parts = weights.map((w) => (t * BigInt(w)) / sum);
  const remainders = weights.map((w, i) => ({ i, r: (t * BigInt(w)) % sum }));
  let left = Number(t - parts.reduce((a, b) => a + b, 0n));
  remainders.sort((a, b) => (b.r > a.r ? 1 : b.r < a.r ? -1 : a.i - b.i));
  for (const { i } of remainders) {
    if (left <= 0) break;
    parts[i] += 1n;
    left--;
  }
  return parts.map(Number);
}
