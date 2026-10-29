"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { TripChange } from "@/lib/realtime";

const DESCRIPTIONS: Record<TripChange["entity"], Partial<Record<TripChange["action"], string>> & { default: string }> = {
  expense: { created: "added an expense", updated: "edited an expense", deleted: "deleted an expense", restored: "restored an expense", default: "changed an expense" },
  settlement: { created: "recorded a payment", deleted: "deleted a payment", restored: "restored a payment", default: "changed a payment" },
  member: { default: "updated the people on this trip" },
  trip: { default: "changed the trip settings" },
};

/**
 * Keeps trip pages current: refreshes server data whenever anyone changes the
 * trip, and shows who did it. Client state (e.g. a half-filled form) is kept.
 */
export function LiveUpdates({ tripId, userId }: { tripId: string; userId: string }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    let toastTimer: ReturnType<typeof setTimeout> | undefined;
    let connectedBefore = false;
    const refresh = () => {
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 300);
    };

    const events = new EventSource(`/api/trips/${tripId}/events`);
    events.onopen = () => {
      // After a reconnect we may have missed changes, so catch up.
      if (connectedBefore) refresh();
      connectedBefore = true;
    };
    events.onmessage = (e) => {
      const change = JSON.parse(e.data) as Pick<TripChange, "actorUserId" | "actorName" | "entity" | "action">;
      refresh();
      if (change.actorUserId !== userId) {
        const d = DESCRIPTIONS[change.entity];
        setToast(`${change.actorName} ${d[change.action] ?? d.default}`);
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => setToast(null), 4000);
      }
    };

    // Phones suspend background tabs; catch up when the page comes back.
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      events.close();
      clearTimeout(refreshTimer);
      clearTimeout(toastTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tripId, userId, router]);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto w-fit max-w-[calc(100%-2rem)] rounded-full bg-stone-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-stone-100 dark:text-stone-900"
    >
      {toast}
    </div>
  );
}
