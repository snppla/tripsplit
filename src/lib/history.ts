import { eq, inArray } from "drizzle-orm";
import type { Db, Tx } from "@/db";
import { expenseSplits, expenses, settlements, tripEvents, tripMembers } from "@/db/schema";
import { formatDate } from "./format";
import { formatMoney } from "./money";

// Snapshots store member names alongside ids so history stays readable even
// after people are renamed or removed.

export type ExpenseSnapshot = {
  description: string;
  category: string | null;
  notes: string | null;
  date: string;
  amount: number;
  currency: string;
  exchangeRate: string;
  baseAmount: number;
  paidById: string;
  paidByName: string;
  splitType: "equal" | "exact" | "shares";
  splits: { memberId: string; name: string; weight: number; baseAmount: number }[];
  createdById: string | null;
  createdAt: string;
};

export type SettlementSnapshot = {
  fromMemberId: string;
  fromName: string;
  toMemberId: string;
  toName: string;
  amount: number;
  date: string;
  note: string | null;
  createdById: string | null;
  createdAt: string;
};

export type MemberSnapshot = { name: string; email: string | null; userId: string | null };

export type TripSnapshot = {
  name: string;
  description: string | null;
  baseCurrency: string;
  startDate: string | null;
  endDate: string | null;
};

async function memberNames(db: Db | Tx, ids: string[]) {
  if (ids.length === 0) return new Map<string, string>();
  const rows = await db
    .select({ id: tripMembers.id, name: tripMembers.name })
    .from(tripMembers)
    .where(inArray(tripMembers.id, ids));
  return new Map(rows.map((r) => [r.id, r.name]));
}

export async function snapshotExpense(db: Db | Tx, expenseId: string): Promise<ExpenseSnapshot | null> {
  const [e] = await db.select().from(expenses).where(eq(expenses.id, expenseId));
  if (!e) return null;
  const splits = await db.select().from(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
  const names = await memberNames(db, [e.paidById, ...splits.map((s) => s.memberId)]);
  return {
    description: e.description,
    category: e.category,
    notes: e.notes,
    date: e.date,
    amount: e.amount,
    currency: e.currency,
    exchangeRate: e.exchangeRate,
    baseAmount: e.baseAmount,
    paidById: e.paidById,
    paidByName: names.get(e.paidById) ?? "?",
    splitType: e.splitType,
    splits: splits.map((s) => ({
      memberId: s.memberId,
      name: names.get(s.memberId) ?? "?",
      weight: s.weight,
      baseAmount: s.baseAmount,
    })),
    createdById: e.createdById,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function snapshotSettlement(db: Db | Tx, settlementId: string): Promise<SettlementSnapshot | null> {
  const [s] = await db.select().from(settlements).where(eq(settlements.id, settlementId));
  if (!s) return null;
  const names = await memberNames(db, [s.fromMemberId, s.toMemberId]);
  return {
    fromMemberId: s.fromMemberId,
    fromName: names.get(s.fromMemberId) ?? "?",
    toMemberId: s.toMemberId,
    toName: names.get(s.toMemberId) ?? "?",
    amount: s.amount,
    date: s.date,
    note: s.note,
    createdById: s.createdById,
    createdAt: s.createdAt.toISOString(),
  };
}

export async function logEvent(
  db: Db | Tx,
  event: {
    tripId: string;
    actor: { userId: string; name: string };
    entity: "trip" | "member" | "expense" | "settlement";
    entityId: string;
    action: "created" | "updated" | "deleted" | "restored";
    before?: unknown;
    after?: unknown;
  },
) {
  await db.insert(tripEvents).values({
    tripId: event.tripId,
    actorUserId: event.actor.userId,
    actorName: event.actor.name,
    entity: event.entity,
    entityId: event.entityId,
    action: event.action,
    before: event.before ?? null,
    after: event.after ?? null,
  });
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

export type Change = { field: string; from: string; to: string };

export function splitSummary(s: ExpenseSnapshot) {
  const names = s.splits.map((p) => p.name).join(", ");
  if (s.splitType === "equal") return `Equally: ${names}`;
  if (s.splitType === "shares") return `Shares: ${s.splits.map((p) => `${p.name} ×${p.weight}`).join(", ")}`;
  return `Exact: ${s.splits.map((p) => `${p.name} ${formatMoney(p.weight, s.currency)}`).join(", ")}`;
}

export function describeExpenseChanges(a: ExpenseSnapshot, b: ExpenseSnapshot): Change[] {
  const fields: [string, (s: ExpenseSnapshot) => string][] = [
    ["Description", (s) => s.description],
    ["Amount", (s) => formatMoney(s.amount, s.currency)],
    ["Exchange rate", (s) => String(Number(s.exchangeRate))],
    ["Date", (s) => formatDate(s.date, { month: "short", day: "numeric", year: "numeric" })],
    ["Paid by", (s) => s.paidByName],
    ["Split", splitSummary],
    ["Category", (s) => s.category ?? "—"],
    ["Notes", (s) => s.notes ?? "—"],
  ];
  return fields.flatMap(([field, get]) => (get(a) === get(b) ? [] : [{ field, from: get(a), to: get(b) }]));
}

export function describeTripChanges(a: TripSnapshot, b: TripSnapshot): Change[] {
  const fields: [string, (s: TripSnapshot) => string][] = [
    ["Name", (s) => s.name],
    ["Description", (s) => s.description ?? "—"],
    ["Currency", (s) => s.baseCurrency],
    ["Starts", (s) => s.startDate ?? "—"],
    ["Ends", (s) => s.endDate ?? "—"],
  ];
  return fields.flatMap(([field, get]) => (get(a) === get(b) ? [] : [{ field, from: get(a), to: get(b) }]));
}
