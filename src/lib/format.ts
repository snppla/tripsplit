export function formatDate(d: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(`${d}T00:00:00Z`).toLocaleDateString("en", { ...opts, timeZone: "UTC" });
}

export function formatDateRange(start: string | null, end: string | null) {
  if (!start && !end) return null;
  const full: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
  if (start && end) return `${formatDate(start)} – ${formatDate(end, full)}`;
  return formatDate((start ?? end)!, full);
}

/** Today's date (YYYY-MM-DD) in the server's timezone (set TZ in .env). */
export function today() {
  return new Date().toLocaleDateString("en-CA");
}
