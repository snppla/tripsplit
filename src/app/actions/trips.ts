"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/db";
import { expenses, tripMembers, trips } from "@/db/schema";
import { isDate, str, type ActionState } from "@/lib/action";
import { logEvent } from "@/lib/history";
import { requireMember, newInviteToken } from "@/lib/members";
import { isCurrency } from "@/lib/money";

function parseTripForm(formData: FormData) {
  const name = str(formData, "name");
  const description = str(formData, "description") || null;
  const baseCurrency = str(formData, "baseCurrency").toUpperCase();
  const startDate = str(formData, "startDate") || null;
  const endDate = str(formData, "endDate") || null;
  if (!name) return { error: "Give the trip a name." } as const;
  if (!isCurrency(baseCurrency)) return { error: "Pick a valid currency." } as const;
  if ((startDate && !isDate(startDate)) || (endDate && !isDate(endDate)))
    return { error: "Invalid date." } as const;
  if (startDate && endDate && endDate < startDate)
    return { error: "The trip can't end before it starts." } as const;
  return { values: { name, description, baseCurrency, startDate, endDate } } as const;
}

export async function createTrip(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();
  const parsed = parseTripForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  const tripId = await db.transaction(async (tx) => {
    const [trip] = await tx
      .insert(trips)
      .values({ ...parsed.values, inviteToken: newInviteToken(), createdById: user.id })
      .returning({ id: trips.id });
    await tx.insert(tripMembers).values({
      tripId: trip.id,
      userId: user.id,
      name: user.name ?? user.email ?? "Me",
      email: user.email,
      role: "owner",
    });
    return trip.id;
  });
  redirect(`/trips/${tripId}`);
}

export async function updateTrip(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, member: me, trip, isOwner } = await requireMember(tripId);
  if (!isOwner) return { error: "Only the trip owner can change settings." };
  const parsed = parseTripForm(formData);
  if ("error" in parsed) return { error: parsed.error };

  if (parsed.values.baseCurrency !== trip.baseCurrency) {
    const [{ n }] = await db.select({ n: count() }).from(expenses).where(eq(expenses.tripId, tripId));
    if (n > 0) return { error: "The base currency can't change once expenses have been added." };
  }
  await db.update(trips).set(parsed.values).where(eq(trips.id, tripId));
  const { name, description, baseCurrency, startDate, endDate } = trip;
  await logEvent(db, {
    tripId,
    actor: { userId: user.id, name: me.name },
    entity: "trip",
    entityId: tripId,
    action: "updated",
    before: { name, description, baseCurrency, startDate, endDate },
    after: parsed.values,
  });
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok: "Saved." };
}

export async function regenerateInvite(tripId: string) {
  const { isOwner } = await requireMember(tripId);
  if (!isOwner) return;
  await db.update(trips).set({ inviteToken: newInviteToken() }).where(eq(trips.id, tripId));
  revalidatePath(`/trips/${tripId}`, "layout");
}

export async function deleteTrip(tripId: string) {
  const { isOwner } = await requireMember(tripId);
  if (!isOwner) return;
  await db.delete(trips).where(eq(trips.id, tripId));
  redirect("/");
}
