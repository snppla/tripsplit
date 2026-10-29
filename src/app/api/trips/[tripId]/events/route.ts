import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { tripMembers } from "@/db/schema";
import { tripChanges, type TripChange } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** Server-Sent Events stream of changes to one trip. */
export async function GET(req: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });
  const member = await db.query.tripMembers.findFirst({
    where: and(eq(tripMembers.tripId, tripId), eq(tripMembers.userId, session.user.id)),
  });
  if (!member) return new Response("Not found", { status: 404 });

  const emitter = tripChanges();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const onChange = ({ actorUserId, actorName, entity, action }: TripChange) =>
        send(`data: ${JSON.stringify({ actorUserId, actorName, entity, action })}\n\n`);
      // Comment lines keep proxies (e.g. Cloudflare's ~100s idle timeout) from closing the stream.
      const ping = setInterval(() => send(": ping\n\n"), 25_000);

      emitter.on(tripId, onChange);
      cleanup = () => {
        clearInterval(ping);
        emitter.off(tripId, onChange);
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
      send("retry: 3000\n\n");
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
