import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { tripMembers, trips } from "@/db/schema";
import { requireUser } from "@/auth";

/**
 * Loads a trip the current user belongs to, or 404s. Use in every page and
 * action that touches trip data.
 */
export async function requireMember(tripId: string) {
  const user = await requireUser(`/trips/${tripId}`);
  const member = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, user.id)),
  });
  if (!member) notFound();
  const trip = await db.query.trips.findFirst({ where: eq(trips.id, tripId) });
  if (!trip) notFound();
  return { user, member, trip, isOwner: member.role === "owner" };
}

export function inviteUrl(token: string) {
  const base = (process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/join/${token}`;
}

export function newInviteToken() {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
}
