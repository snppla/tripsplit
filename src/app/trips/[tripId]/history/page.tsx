import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tripEvents } from "@/db/schema";
import { requireMember } from "@/lib/members";
import { loadTripData } from "@/lib/trip-data";
import { HistoryList } from "@/components/HistoryList";

export default async function HistoryPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { trip } = await requireMember(tripId);
  const [events, { expenses, settlements }] = await Promise.all([
    db.query.tripEvents.findMany({
      where: eq(tripEvents.tripId, tripId),
      orderBy: [desc(tripEvents.createdAt)],
      limit: 500,
    }),
    loadTripData(tripId),
  ]);
  const existingIds = new Set([...expenses.map((e) => e.id), ...settlements.map((s) => s.id)]);

  return (
    <div className="space-y-3">
      <p className="muted text-sm">
        Every change anyone makes is recorded here. Deleted expenses and payments can be restored, and edits can be reverted.
      </p>
      <HistoryList tripId={tripId} baseCurrency={trip.baseCurrency} events={events} existingIds={existingIds} />
    </div>
  );
}
