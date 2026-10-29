import { EventEmitter } from "node:events";
import { Client } from "pg";

export type TripChange = {
  tripId: string;
  actorUserId: string | null;
  actorName: string;
  entity: "trip" | "member" | "expense" | "settlement";
  action: "created" | "updated" | "deleted" | "restored";
};

const g = globalThis as unknown as { tripChanges?: EventEmitter };

/**
 * Process-wide emitter of trip changes, keyed by trip id. Backed by a single
 * Postgres LISTEN connection on the `trip_events` channel, which a trigger on
 * trip_event notifies (drizzle/0002_notify_trip_events.sql).
 */
export function tripChanges(): EventEmitter {
  if (!g.tripChanges) {
    g.tripChanges = new EventEmitter();
    g.tripChanges.setMaxListeners(0);
    void listen(g.tripChanges);
  }
  return g.tripChanges;
}

async function listen(emitter: EventEmitter) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  let retrying = false;
  const retry = (err: unknown) => {
    if (retrying) return;
    retrying = true;
    console.error("Realtime listener disconnected; retrying", err);
    client.end().catch(() => {});
    setTimeout(() => void listen(emitter), 2000);
  };
  client.on("error", retry);
  client.on("end", () => retry("connection ended"));
  client.on("notification", (msg) => {
    try {
      const change = JSON.parse(msg.payload ?? "") as TripChange;
      emitter.emit(change.tripId, change);
    } catch {
      // ignore malformed payloads
    }
  });
  try {
    await client.connect();
    await client.query("LISTEN trip_events");
  } catch (err) {
    retry(err);
  }
}
