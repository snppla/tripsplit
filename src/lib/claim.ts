import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { tripMembers } from "@/db/schema";
import { logEvent } from "./history";

/** Links any pending email invites for this address to the user. */
export async function claimEmailInvites(userId: string, email: string) {
  const pending = await db
    .select()
    .from(tripMembers)
    .where(and(isNull(tripMembers.userId), sql`lower(${tripMembers.email}) = ${email.toLowerCase()}`));
  for (const p of pending) {
    // Skip trips the user already belongs to (unique on trip+user).
    const existing = await db.query.tripMembers.findFirst({
      where: and(eq(tripMembers.tripId, p.tripId), eq(tripMembers.userId, userId)),
    });
    if (!existing) {
      await db.update(tripMembers).set({ userId }).where(eq(tripMembers.id, p.id));
      await logEvent(db, {
        tripId: p.tripId,
        actor: { userId, name: p.name },
        entity: "member",
        entityId: p.id,
        action: "updated",
        before: { name: p.name, email: p.email, userId: null },
        after: { name: p.name, email: p.email, userId },
      });
    }
  }
}
