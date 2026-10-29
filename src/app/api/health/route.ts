import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Health check for Docker/Swarm: healthy once the server is up and can reach
 * the database. Rolling deploys wait for this before retiring the old copy.
 */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
