import { requireUser } from "@/auth";
import { createTrip } from "@/app/actions/trips";
import { TripForm } from "@/components/TripForm";
import { BackToTrips } from "@/components/TripTabs";

export default async function NewTripPage() {
  await requireUser("/trips/new");
  return (
    <div className="space-y-3">
      <BackToTrips />
      <div className="card p-6">
        <h1 className="mb-5 text-xl font-semibold">Start a trip</h1>
        <TripForm action={createTrip} submitLabel="Create trip" />
      </div>
    </div>
  );
}
