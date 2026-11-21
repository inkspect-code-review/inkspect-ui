export type FindingsPeriod = "all" | 7 | 15 | 30 | { from: string; to: string };

export function reviewDateBounds(period: FindingsPeriod, today = new Date()) {
  if (period === "all") return { from: "", before: "" };
  let start: Date | undefined;
  let end: Date | undefined;
  if (typeof period === "number") {
    start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - period + 1);
    end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  } else {
    if (period.from) start = new Date(`${period.from}T00:00:00`);
    if (period.to) end = new Date(`${period.to}T00:00:00`);
  }
  // The API uses an exclusive upper bound. Advance a local calendar day across DST.
  if (end) end.setDate(end.getDate() + 1);
  return { from: start?.toISOString() ?? "", before: end?.toISOString() ?? "" };
}
