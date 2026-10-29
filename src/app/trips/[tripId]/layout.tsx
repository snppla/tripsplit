import { requireMember } from "@/lib/members";
import { formatDateRange } from "@/lib/format";
import { BackToTrips, TripTabs } from "@/components/TripTabs";
import { LiveUpdates } from "@/components/LiveUpdates";

export default async function TripLayout({
  params,
  children,
}: {
  params: Promise<{ tripId: string }>;
  children: React.ReactNode;
}) {
  const { tripId } = await params;
  const { user, trip, isOwner } = await requireMember(tripId);
  const dates = formatDateRange(trip.startDate, trip.endDate);
  return (
    <div className="space-y-5">
      <div>
        <BackToTrips />
        <h1 className="mt-1 text-2xl font-bold tracking-tight">{trip.name}</h1>
        <p className="muted mt-1 text-sm">
          {[dates, `Settling in ${trip.baseCurrency}`].filter(Boolean).join(" · ")}
        </p>
        {trip.description && <p className="mt-2 text-sm">{trip.description}</p>}
      </div>
      <TripTabs tripId={trip.id} isOwner={isOwner} />
      {children}
      <LiveUpdates tripId={trip.id} userId={user.id} />
    </div>
  );
}
