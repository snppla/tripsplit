import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/db";
import { tripMembers, trips } from "@/db/schema";
import { formatDateRange } from "@/lib/format";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const myTrips = await db
    .select({ trip: trips, role: tripMembers.role })
    .from(tripMembers)
    .innerJoin(trips, eq(trips.id, tripMembers.tripId))
    .where(eq(tripMembers.userId, session.user.id))
    .orderBy(desc(trips.startDate), desc(trips.createdAt));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your trips</h1>
        <Link href="/trips/new" className="btn-primary">+ New trip</Link>
      </div>
      {myTrips.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-medium">No trips yet</p>
          <p className="muted mt-1 text-sm">
            Start one and invite your friends, or ask the organizer for their invite link.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {myTrips.map(({ trip }) => (
            <li key={trip.id}>
              <Link href={`/trips/${trip.id}`} className="card block p-4 transition hover:border-brand-500">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{trip.name}</span>
                  <span className="muted text-xs">{trip.baseCurrency}</span>
                </div>
                {formatDateRange(trip.startDate, trip.endDate) && (
                  <p className="muted mt-1 text-sm">{formatDateRange(trip.startDate, trip.endDate)}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
