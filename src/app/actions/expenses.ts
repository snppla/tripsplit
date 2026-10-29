"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/auth";
import { db } from "@/db";
import { expenseSplits, expenses, tripEvents, tripMembers } from "@/db/schema";
import { isDate, type ActionState } from "@/lib/action";
import { fetchRate } from "@/lib/fx";
import { describeExpenseChanges, logEvent, snapshotExpense, type ExpenseSnapshot } from "@/lib/history";
import { requireMember } from "@/lib/members";
import { allocate, amountError, convertToBase, isCurrency, parseAmount } from "@/lib/money";

const expenseInput = z.object({
  description: z.string().trim().min(1, "Add a description."),
  category: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  date: z.string().refine(isDate, "Pick a date."),
  amount: z.string(),
  currency: z.string().refine(isCurrency, "Pick a valid currency."),
  exchangeRate: z.string(),
  paidById: z.string().min(1, "Choose who paid."),
  splitType: z.enum(["equal", "exact", "shares"]),
  // For "equal" the value is ignored; for "shares" it's a whole number of
  // shares; for "exact" it's an amount in the expense currency.
  splits: z.array(z.object({ memberId: z.string(), value: z.string() })),
});

export type ExpenseInput = z.infer<typeof expenseInput>;

export async function saveExpense(
  tripId: string,
  expenseId: string | null,
  raw: ExpenseInput,
): Promise<ActionState> {
  const { user, trip, member: me } = await requireMember(tripId);
  const parsed = expenseInput.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const input = parsed.data;

  const amountProblem = amountError(input.amount, input.currency);
  if (amountProblem) return { error: amountProblem };
  const amount = parseAmount(input.amount, input.currency)!;

  const rate = input.currency === trip.baseCurrency ? 1 : Number(input.exchangeRate);
  if (!Number.isFinite(rate) || rate <= 0) return { error: "Enter a valid exchange rate." };

  const members = await db.query.tripMembers.findMany({ where: eq(tripMembers.tripId, tripId) });
  const memberIds = new Set(members.map((m) => m.id));
  if (!memberIds.has(input.paidById)) return { error: "Choose who paid." };

  // Turn every split type into integer weights.
  const weights: { memberId: string; weight: number }[] = [];
  for (const s of input.splits) {
    if (!memberIds.has(s.memberId)) return { error: "Unknown participant." };
    let weight: number | null;
    if (input.splitType === "equal") weight = 1;
    else if (input.splitType === "shares") weight = /^\d+$/.test(s.value.trim()) ? Number(s.value) : null;
    else {
      const problem = amountError(s.value, input.currency, { allowZero: true });
      if (problem) {
        const name = members.find((m) => m.id === s.memberId)?.name;
        return { error: `${name}'s amount: ${problem}` };
      }
      weight = s.value.trim() === "" ? 0 : parseAmount(s.value, input.currency);
    }
    if (weight === null) return { error: "Shares must be whole numbers." };
    if (weight > 0) weights.push({ memberId: s.memberId, weight });
  }
  if (weights.length === 0) return { error: "Choose at least one person to split with." };
  if (input.splitType === "exact") {
    const sum = weights.reduce((a, w) => a + w.weight, 0);
    if (sum !== amount) return { error: "The exact amounts must add up to the total." };
  }

  const baseAmount = convertToBase(amount, input.currency, rate, trip.baseCurrency);
  const parts = allocate(baseAmount, weights.map((w) => w.weight));

  const values = {
    tripId,
    paidById: input.paidById,
    description: input.description,
    category: input.category || null,
    notes: input.notes || null,
    date: input.date,
    amount,
    currency: input.currency,
    exchangeRate: String(rate),
    baseAmount,
    splitType: input.splitType,
  };

  await db.transaction(async (tx) => {
    let id = expenseId;
    const before = id ? await snapshotExpense(tx, id) : null;
    if (id) {
      const updated = await tx
        .update(expenses)
        .set({ ...values, updatedAt: new Date() })
        .where(and(eq(expenses.id, id), eq(expenses.tripId, tripId)))
        .returning({ id: expenses.id });
      if (updated.length === 0) throw new Error("Expense not found");
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, id));
    } else {
      [{ id }] = await tx
        .insert(expenses)
        .values({ ...values, createdById: user.id })
        .returning({ id: expenses.id });
    }
    await tx.insert(expenseSplits).values(
      weights.map((w, i) => ({ expenseId: id!, memberId: w.memberId, weight: w.weight, baseAmount: parts[i] })),
    );
    const after = (await snapshotExpense(tx, id!))!;
    if (before && describeExpenseChanges(before, after).length === 0) return;
    await logEvent(tx, {
      tripId,
      actor: { userId: user.id, name: me.name },
      entity: "expense",
      entityId: id!,
      action: before ? "updated" : "created",
      before,
      after,
    });
  });

  revalidatePath(`/trips/${tripId}`, "layout");
  redirect(`/trips/${tripId}`);
}

export async function deleteExpense(tripId: string, expenseId: string) {
  const { user, member: me } = await requireMember(tripId);
  await db.transaction(async (tx) => {
    const existing = await tx.query.expenses.findFirst({
      where: and(eq(expenses.id, expenseId), eq(expenses.tripId, tripId)),
    });
    if (!existing) return;
    const before = await snapshotExpense(tx, expenseId);
    await tx.delete(expenses).where(eq(expenses.id, expenseId));
    await logEvent(tx, {
      tripId,
      actor: { userId: user.id, name: me.name },
      entity: "expense",
      entityId: expenseId,
      action: "deleted",
      before,
    });
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  redirect(`/trips/${tripId}`);
}

/**
 * Puts an expense back the way it was before a logged edit or deletion,
 * recreating it if it no longer exists.
 */
export async function restoreExpense(tripId: string, eventId: string): Promise<ActionState> {
  const { user, member: me } = await requireMember(tripId);
  const event = await db.query.tripEvents.findFirst({
    where: and(eq(tripEvents.id, eventId), eq(tripEvents.tripId, tripId), eq(tripEvents.entity, "expense")),
  });
  const snap = event?.before as ExpenseSnapshot | null | undefined;
  if (!event || !snap) return { error: "Nothing to restore." };

  const members = await db.query.tripMembers.findMany({ where: eq(tripMembers.tripId, tripId) });
  const ids = new Set(members.map((m) => m.id));
  const missing = [snap.paidById, ...snap.splits.map((s) => s.memberId)].filter((id) => !ids.has(id));
  if (missing.length > 0) return { error: "Someone in this expense has since been removed from the trip." };

  const values = {
    tripId,
    paidById: snap.paidById,
    description: snap.description,
    category: snap.category,
    notes: snap.notes,
    date: snap.date,
    amount: snap.amount,
    currency: snap.currency,
    exchangeRate: snap.exchangeRate,
    baseAmount: snap.baseAmount,
    splitType: snap.splitType,
  };
  const expenseId = event.entityId;

  await db.transaction(async (tx) => {
    const before = await snapshotExpense(tx, expenseId);
    if (before) {
      await tx.update(expenses).set({ ...values, updatedAt: new Date() }).where(eq(expenses.id, expenseId));
      await tx.delete(expenseSplits).where(eq(expenseSplits.expenseId, expenseId));
    } else {
      await tx.insert(expenses).values({
        ...values,
        id: expenseId,
        createdById: snap.createdById,
        createdAt: new Date(snap.createdAt),
      });
    }
    await tx.insert(expenseSplits).values(
      snap.splits.map((s) => ({ expenseId, memberId: s.memberId, weight: s.weight, baseAmount: s.baseAmount })),
    );
    await logEvent(tx, {
      tripId,
      actor: { userId: user.id, name: me.name },
      entity: "expense",
      entityId: expenseId,
      action: "restored",
      before,
      after: await snapshotExpense(tx, expenseId),
    });
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: `Restored "${snap.description}".` };
}

export async function lookupRate(from: string, to: string, date: string): Promise<number | null> {
  await requireUser();
  if (!isCurrency(from) || !isCurrency(to)) return null;
  return fetchRate(from, to, isDate(date) ? date : undefined);
}
