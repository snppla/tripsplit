"use server";

import { and, count, eq, isNull, or, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/db";
import { expenseSplits, expenses, settlements, tripMembers, trips, users } from "@/db/schema";
import { str, type ActionState } from "@/lib/action";
import { emailEnabled, sendInviteEmail } from "@/lib/email";
import { logEvent, type MemberSnapshot } from "@/lib/history";
import { inviteUrl, requireMember } from "@/lib/members";

const snap = (m: { name: string; email: string | null; userId: string | null }): MemberSnapshot => ({
  name: m.name,
  email: m.email,
  userId: m.userId,
});

export async function addMember(tripId: string, _: ActionState, formData: FormData): Promise<ActionState> {
  const { user, trip, member: me } = await requireMember(tripId);
  const email = str(formData, "email").toLowerCase() || null;
  const name = str(formData, "name") || email?.split("@")[0] || "";
  if (!name) return { error: "Enter a name or email." };
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "That email doesn't look right." };

  if (email) {
    const dup = await db.query.tripMembers.findFirst({
      where: and(eq(tripMembers.tripId, tripId), sql`lower(${tripMembers.email}) = ${email}`),
    });
    if (dup) return { error: `${email} is already on this trip.` };
  }

  // If they've used the app before, link them right away.
  const existingUser = email
    ? await db.query.users.findFirst({ where: sql`lower(${users.email}) = ${email}` })
    : undefined;
  let userId: string | null = existingUser?.id ?? null;
  if (userId) {
    const already = await db.query.tripMembers.findFirst({
      where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, userId)),
    });
    if (already) return { error: `${email} is already on this trip as ${already.name}.` };
  }

  const [added] = await db.insert(tripMembers).values({ tripId, userId, name, email }).returning();
  await logEvent(db, {
    tripId,
    actor: { userId: user.id, name: me.name },
    entity: "member",
    entityId: added.id,
    action: "created",
    after: snap(added),
  });

  let ok = `Added ${name}.`;
  if (email && emailEnabled()) {
    try {
      await sendInviteEmail({
        to: email,
        inviterName: me.name || user.name || "A friend",
        tripName: trip.name,
        link: inviteUrl(trip.inviteToken),
      });
      ok = `Added ${name} and emailed an invite to ${email}.`;
    } catch (err) {
      console.error("Failed to send invite email", err);
      ok = `Added ${name}, but the invite email failed to send. Share the invite link instead.`;
    }
  }
  revalidatePath(`/trips/${tripId}`, "layout");
  return { ok };
}

export async function resendInvite(tripId: string, memberId: string) {
  const { user, trip, member: me } = await requireMember(tripId);
  const target = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, tripId), isNull(tripMembers.userId)),
  });
  if (!target?.email || !emailEnabled()) return;
  await sendInviteEmail({
    to: target.email,
    inviterName: me.name || user.name || "A friend",
    tripName: trip.name,
    link: inviteUrl(trip.inviteToken),
  });
}

export async function renameMember(tripId: string, memberId: string, formData: FormData) {
  const { user, member: me, isOwner } = await requireMember(tripId);
  if (!isOwner && me.id !== memberId) return;
  const name = str(formData, "name");
  if (!name) return;
  const target = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, tripId)),
  });
  if (!target || target.name === name) return;
  await db.update(tripMembers).set({ name }).where(eq(tripMembers.id, memberId));
  await logEvent(db, {
    tripId,
    actor: { userId: user.id, name: me.name },
    entity: "member",
    entityId: memberId,
    action: "updated",
    before: snap(target),
    after: snap({ ...target, name }),
  });
  revalidatePath(`/trips/${tripId}`, "layout");
}

export async function removeMember(tripId: string, memberId: string): Promise<ActionState> {
  const { user, member: me, isOwner } = await requireMember(tripId);
  if (!isOwner) return { error: "Only the trip owner can remove people." };
  const target = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.id, memberId), eq(tripMembers.tripId, tripId)),
  });
  if (!target) return;
  if (target.role === "owner") return { error: "The owner can't be removed." };

  const [[paid], [split], [settled]] = await Promise.all([
    db.select({ n: count() }).from(expenses).where(eq(expenses.paidById, memberId)),
    db.select({ n: count() }).from(expenseSplits).where(eq(expenseSplits.memberId, memberId)),
    db
      .select({ n: count() })
      .from(settlements)
      .where(or(eq(settlements.fromMemberId, memberId), eq(settlements.toMemberId, memberId))),
  ]);
  if (paid.n + split.n + settled.n > 0) {
    return { error: `${target.name} is part of expenses or payments; remove them from those first.` };
  }
  await db.delete(tripMembers).where(eq(tripMembers.id, memberId));
  await logEvent(db, {
    tripId,
    actor: { userId: user.id, name: me.name },
    entity: "member",
    entityId: memberId,
    action: "deleted",
    before: snap(target),
  });
  revalidatePath(`/trips/${tripId}`, "layout");
}

/**
 * Joins a trip via its invite link. `claim` optionally names an unclaimed
 * placeholder member the user says is them.
 */
export async function joinTrip(token: string, formData: FormData) {
  const user = await requireUser(`/join/${token}`);
  const trip = await db.query.trips.findFirst({ where: eq(trips.inviteToken, token) });
  if (!trip) redirect("/");

  const already = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id)),
  });
  if (!already) {
    const claim = str(formData, "claim");
    const placeholder = claim
      ? await db.query.tripMembers.findFirst({
          where: and(eq(tripMembers.id, claim), eq(tripMembers.tripId, trip.id), isNull(tripMembers.userId)),
        })
      : undefined;
    if (placeholder) {
      const claimed = { userId: user.id, email: placeholder.email ?? user.email };
      await db.update(tripMembers).set(claimed).where(eq(tripMembers.id, placeholder.id));
      // Logged with the Google account name so a wrongly claimed spot is easy to spot.
      await logEvent(db, {
        tripId: trip.id,
        actor: { userId: user.id, name: user.name ?? user.email ?? "Someone" },
        entity: "member",
        entityId: placeholder.id,
        action: "updated",
        before: snap(placeholder),
        after: snap({ ...placeholder, ...claimed }),
      });
    } else {
      const [joined] = await db
        .insert(tripMembers)
        .values({ tripId: trip.id, userId: user.id, name: user.name ?? user.email ?? "Guest", email: user.email })
        .returning();
      await logEvent(db, {
        tripId: trip.id,
        actor: { userId: user.id, name: joined.name },
        entity: "member",
        entityId: joined.id,
        action: "created",
        after: snap(joined),
      });
    }
  }
  redirect(`/trips/${trip.id}`);
}
