import { count, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { deleteTrip, updateTrip } from "@/app/actions/trips";
import { requireMember } from "@/lib/members";
import { ConfirmButton } from "@/components/ConfirmButton";
import { TripForm } from "@/components/TripForm";

export default async function SettingsPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const { trip, isOwner } = await requireMember(tripId);
  if (!isOwner) notFound();
  const [{ n }] = await db.select({ n: count() }).from(expenses).where(eq(expenses.tripId, tripId));

  return (
    <div className="space-y-6">
      <section className="card p-5">
        <h2 className="mb-4 font-semibold">Trip details</h2>
        <TripForm action={updateTrip.bind(null, tripId)} trip={trip} submitLabel="Save" currencyLocked={n > 0} />
      </section>
      <section className="card border-red-200! p-5 dark:border-red-900!">
        <h2 className="font-semibold">Delete trip</h2>
        <p className="muted mt-1 mb-4 text-sm">Permanently deletes the trip, its expenses and payments for everyone.</p>
        <ConfirmButton
          action={deleteTrip.bind(null, tripId)}
          confirm={`Delete "${trip.name}" and all of its expenses? This can't be undone.`}
          className="btn-danger"
        >
          Delete trip
        </ConfirmButton>
      </section>
    </div>
  );
}
