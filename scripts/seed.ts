/**
 * Loads a sample trip for local development. Safe to re-run: it replaces the
 * sample trip each time and leaves everything else alone.
 *
 *   npm run db:seed
 */
import { loadDevEnv } from "./load-env";

loadDevEnv();

const SAMPLE_TRIP_ID = "sample-lisbon";

async function main() {
  // Imported after env is loaded, since the db pool reads DATABASE_URL.
  const { eq } = await import("drizzle-orm");
  const { db } = await import("@/db");
  const { runMigrations } = await import("@/db/migrate");
  const schema = await import("@/db/schema");
  const { DEV_USERS } = await import("@/lib/dev-login");
  const { logEvent, snapshotExpense, snapshotSettlement } = await import("@/lib/history");
  const { allocate, convertToBase } = await import("@/lib/money");

  await runMigrations();

  // Dev users (the same ones the dev-login buttons use).
  const userIds: string[] = [];
  for (const u of DEV_USERS) {
    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, u.email) });
    userIds.push(existing?.id ?? (await db.insert(schema.users).values(u).returning())[0].id);
  }
  const [aliceId, bobId, carolId] = userIds;

  await db.delete(schema.trips).where(eq(schema.trips.id, SAMPLE_TRIP_ID));

  await db.transaction(async (tx) => {
    await tx.insert(schema.trips).values({
      id: SAMPLE_TRIP_ID,
      name: "Lisbon (sample)",
      description: "Seeded sample data for local development.",
      baseCurrency: "USD",
      startDate: "2027-05-01",
      endDate: "2027-05-08",
      inviteToken: "sample-invite",
      createdById: aliceId,
    });

    const member = async (name: string, userId: string | null, email: string | null, role: "owner" | "member" = "member") =>
      (await tx.insert(schema.tripMembers).values({ tripId: SAMPLE_TRIP_ID, userId, name, email, role }).returning())[0].id;
    const alice = await member("Alice", aliceId, DEV_USERS[0].email, "owner");
    const bob = await member("Bob", bobId, DEV_USERS[1].email);
    const carol = await member("Carol", carolId, DEV_USERS[2].email);
    const dan = await member("Dan", null, null); // placeholder, never signed up
    await member("Erin", null, "erin@dev.local"); // pending email invite

    const actors = new Map([
      [alice, { userId: aliceId, name: "Alice" }],
      [bob, { userId: bobId, name: "Bob" }],
      [carol, { userId: carolId, name: "Carol" }],
      [dan, { userId: aliceId, name: "Alice" }],
    ]);

    async function expense(e: {
      description: string;
      category: string;
      date: string;
      amount: number;
      currency: string;
      rate: number;
      paidBy: string;
      splitType: "equal" | "shares" | "exact";
      split: [string, number][];
    }) {
      const baseAmount = convertToBase(e.amount, e.currency, e.rate, "USD");
      const parts = allocate(baseAmount, e.split.map(([, w]) => w));
      const [{ id }] = await tx
        .insert(schema.expenses)
        .values({
          tripId: SAMPLE_TRIP_ID,
          paidById: e.paidBy,
          description: e.description,
          category: e.category,
          date: e.date,
          amount: e.amount,
          currency: e.currency,
          exchangeRate: String(e.rate),
          baseAmount,
          splitType: e.splitType,
          createdById: actors.get(e.paidBy)!.userId,
        })
        .returning({ id: schema.expenses.id });
      await tx.insert(schema.expenseSplits).values(
        e.split.map(([memberId, weight], i) => ({ expenseId: id, memberId, weight, baseAmount: parts[i] })),
      );
      await logEvent(tx, {
        tripId: SAMPLE_TRIP_ID,
        actor: actors.get(e.paidBy)!,
        entity: "expense",
        entityId: id,
        action: "created",
        after: await snapshotExpense(tx, id),
      });
    }

    const everyone: [string, number][] = [alice, bob, carol, dan].map((m) => [m, 1]);
    await expense({ description: "Apartment", category: "lodging", date: "2027-03-12", amount: 84000, currency: "EUR", rate: 1.08, paidBy: alice, splitType: "equal", split: everyone });
    await expense({ description: "Airport taxi", category: "transport", date: "2027-05-01", amount: 5500, currency: "EUR", rate: 1.08, paidBy: bob, splitType: "equal", split: everyone });
    await expense({ description: "Groceries", category: "groceries", date: "2027-05-01", amount: 4230, currency: "EUR", rate: 1.08, paidBy: dan, splitType: "equal", split: everyone });
    await expense({ description: "Seafood dinner", category: "food", date: "2027-05-02", amount: 21400, currency: "EUR", rate: 1.08, paidBy: carol, splitType: "exact", split: [[alice, 6200], [bob, 5800], [carol, 4700], [dan, 4700]] });
    await expense({ description: "Surf lessons", category: "activities", date: "2027-05-03", amount: 18000, currency: "EUR", rate: 1.08, paidBy: bob, splitType: "shares", split: [[bob, 2], [carol, 1]] });
    await expense({ description: "Wine tasting deposit", category: "activities", date: "2027-02-20", amount: 12000, currency: "USD", rate: 1, paidBy: alice, splitType: "equal", split: [[alice, 1], [bob, 1], [carol, 1]] });

    const [{ id: settlementId }] = await tx
      .insert(schema.settlements)
      .values({ tripId: SAMPLE_TRIP_ID, fromMemberId: dan, toMemberId: alice, amount: 15000, date: "2027-05-04", note: "Cash", createdById: aliceId })
      .returning({ id: schema.settlements.id });
    await logEvent(tx, {
      tripId: SAMPLE_TRIP_ID,
      actor: actors.get(alice)!,
      entity: "settlement",
      entityId: settlementId,
      action: "created",
      after: await snapshotSettlement(tx, settlementId),
    });
  });

  console.log(`Seeded "Lisbon (sample)" with users ${DEV_USERS.map((u) => u.email).join(", ")}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
