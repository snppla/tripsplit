/**
 * Looks up how many units of `to` one unit of `from` is worth, using the
 * free ECB-backed Frankfurter API. Returns null if unavailable (unsupported
 * currency, network error), in which case the user enters a rate manually.
 */
export async function fetchRate(from: string, to: string, date?: string): Promise<number | null> {
  if (from === to) return 1;
  const today = new Date().toISOString().slice(0, 10);
  const when = date && date < today ? date : "latest";
  const url = `https://api.frankfurter.dev/v1/${when}?base=${from}&symbols=${to}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates?.[to] ?? null;
  } catch {
    return null;
  }
}
