"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { settlements, tripEvents, tripMembers } from "@/db/schema";
import { isDate, str, type ActionState } from "@/lib/action";
import { today } from "@/lib/format";
import { logEvent, snapshotSettlement, type SettlementSnapshot } from "@/lib/history";
import { requireMember } from "@/lib/members";
import { amountError, parseAmount } from "@/lib/money";

export async function recordSettlement(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, trip, member: me } = await requireMember(tripId);
  const fromMemberId = str(formData, "from");
  const toMemberId = str(formData, "to");
  const date = str(formData, "date") || today();
  const note = str(formData, "note") || null;

  if (!fromMemberId || !toMemberId || fromMemberId === toMemberId)
    return { error: "Choose two different people." };
  const amountProblem = amountError(str(formData, "amount"), trip.baseCurrency);
  if (amountProblem) return { error: amountProblem };
  const amount = parseAmount(str(formData, "amount"), trip.baseCurrency)!;
  if (!isDate(date)) return { error: "Invalid date." };

  const members = await db.query.tripMembers.findMany({ where: eq(tripMembers.tripId, tripId) });
  const ids = new Set(members.map((m) => m.id));
  if (!ids.has(fromMemberId) || !ids.has(toMemberId)) return { error: "Unknown person." };

  await db.transaction(async (tx) => {
    const [{ id }] = await tx
      .insert(settlements)
      .values({ tripId, fromMemberId, toMemberId, amount, date, note, createdById: user.id })
      .returning({ id: settlements.id });
    await logEvent(tx, {
      tripId,
      actor: { userId: user.id, name: me.name },
      entity: "settlement",
      entityId: id,
      action: "created",
      after: await snapshotSettlement(tx, id),
    });
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: "Payment recorded." };
}

export async function deleteSettlement(tripId: string, settlementId: string) {
  const { user, member: me } = await requireMember(tripId);
  await db.transaction(async (tx) => {
    const existing = await tx.query.settlements.findFirst({
      where: and(eq(settlements.id, settlementId), eq(settlements.tripId, tripId)),
    });
    if (!existing) return;
    const before = await snapshotSettlement(tx, settlementId);
    await tx.delete(settlements).where(eq(settlements.id, settlementId));
    await logEvent(tx, {
      tripId,
      actor: { userId: user.id, name: me.name },
      entity: "settlement",
      entityId: settlementId,
      action: "deleted",
      before,
    });
  });
  revalidatePath(`/trips/${tripId}`, "layout");
}

/** Recreates a payment from a logged deletion. */
export async function restoreSettlement(tripId: string, eventId: string): Promise<ActionState> {
  const { user, member: me } = await requireMember(tripId);
  const event = await db.query.tripEvents.findFirst({
    where: and(eq(tripEvents.id, eventId), eq(tripEvents.tripId, tripId), eq(tripEvents.entity, "settlement")),
  });
  const snap = event?.before as SettlementSnapshot | null | undefined;
  if (!event || event.action !== "deleted" || !snap) return { error: "Nothing to restore." };
  if (await db.query.settlements.findFirst({ where: eq(settlements.id, event.entityId) }))
    return { error: "That payment already exists." };

  const members = await db.query.tripMembers.findMany({ where: eq(tripMembers.tripId, tripId) });
  const ids = new Set(members.map((m) => m.id));
  if (!ids.has(snap.fromMemberId) || !ids.has(snap.toMemberId))
    return { error: "Someone in this payment has since been removed from the trip." };

  await db.transaction(async (tx) => {
    await tx.insert(settlements).values({
      id: event.entityId,
      tripId,
      fromMemberId: snap.fromMemberId,
      toMemberId: snap.toMemberId,
      amount: snap.amount,
      date: snap.date,
      note: snap.note,
      createdById: snap.createdById,
      createdAt: new Date(snap.createdAt),
    });
    await logEvent(tx, {
      tripId,
      actor: { userId: user.id, name: me.name },
      entity: "settlement",
      entityId: event.entityId,
      action: "restored",
      after: await snapshotSettlement(tx, event.entityId),
    });
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: "Payment restored." };
}

/** Form-action variant used by the "Mark paid" buttons. */
export async function markTransferPaid(tripId: string, formData: FormData) {
  await recordSettlement(tripId, undefined, formData);
}
