import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/auth";
import { db } from "@/db";
import { tripMembers, trips } from "@/db/schema";
import { joinTrip } from "@/app/actions/members";
import { formatDateRange } from "@/lib/format";
import { SubmitButton } from "@/components/SubmitButton";

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const user = await requireUser(`/join/${token}`);
  const trip = await db.query.trips.findFirst({ where: eq(trips.inviteToken, token) });

  if (!trip) {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-semibold">Invite link not valid</h1>
        <p className="muted mt-2">It may have been reset. Ask the trip organizer for a new one.</p>
        <Link href="/" className="btn-secondary mt-6">Go to your trips</Link>
      </div>
    );
  }

  const existing = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, trip.id), eq(tripMembers.userId, user.id)),
  });
  if (existing) redirect(`/trips/${trip.id}`);

  const placeholders = await db.query.tripMembers.findMany({
    where: and(eq(tripMembers.tripId, trip.id), isNull(tripMembers.userId)),
  });
  const action = joinTrip.bind(null, token);
  const dates = formatDateRange(trip.startDate, trip.endDate);

  return (
    <div className="card mx-auto max-w-md p-6">
      <p className="muted text-sm">You&apos;re invited to</p>
      <h1 className="mt-1 text-2xl font-bold tracking-tight">{trip.name}</h1>
      {dates && <p className="muted mt-1 text-sm">{dates}</p>}

      <form action={action} className="mt-6 space-y-4">
        {placeholders.length > 0 && (
          <fieldset className="min-w-0 space-y-2">
            <legend className="label">Are you already on the list?</legend>
            {placeholders.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 dark:border-stone-700">
                <input type="radio" name="claim" value={p.id} className="accent-brand-600" />
                <span>{p.name}</span>
                {p.email && <span className="muted truncate text-xs">{p.email}</span>}
              </label>
            ))}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 px-3 py-2.5 dark:border-stone-700">
              <input type="radio" name="claim" value="" defaultChecked className="accent-brand-600" />
              <span>No, join as {user.name ?? user.email}</span>
            </label>
          </fieldset>
        )}
        <SubmitButton className="btn-primary w-full py-3" pendingText="Joining…">Join trip</SubmitButton>
      </form>
    </div>
  );
}
