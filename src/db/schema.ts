import {
  bigint,
  date,
  jsonb,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

// ---------------------------------------------------------------------------
// Auth.js tables
// ---------------------------------------------------------------------------

export const users = pgTable("user", {
  id: id(),
  name: text("name"),
  email: text("email").unique(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

export const trips = pgTable("trip", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  baseCurrency: text("base_currency").notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  inviteToken: text("invite_token").notNull().unique(),
  createdById: text("created_by_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberRole = pgEnum("member_role", ["owner", "member"]);

/**
 * A person on a trip. `userId` is null until someone signs in and claims the
 * spot — either via an emailed invite (matched on `email`), or by choosing
 * this placeholder when joining through the invite link.
 */
export const tripMembers = pgTable(
  "trip_member",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email"),
    role: memberRole("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trip_member_trip_user_idx").on(t.tripId, t.userId),
    index("trip_member_email_idx").on(t.email),
  ],
);

export const splitType = pgEnum("split_type", ["equal", "exact", "shares"]);

export const expenses = pgTable(
  "expense",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    paidById: text("paid_by_id")
      .notNull()
      .references(() => tripMembers.id),
    description: text("description").notNull(),
    category: text("category"),
    date: date("date").notNull(),
    /** Amount in minor units (cents, etc.) of `currency`. */
    amount: bigint("amount", { mode: "number" }).notNull(),
    currency: text("currency").notNull(),
    /** Units of trip base currency per one unit of `currency`. */
    exchangeRate: numeric("exchange_rate", { precision: 20, scale: 10 }).notNull(),
    /** Amount converted to minor units of the trip base currency. */
    baseAmount: bigint("base_amount", { mode: "number" }).notNull(),
    splitType: splitType("split_type").notNull(),
    notes: text("notes"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("expense_trip_idx").on(t.tripId, t.date)],
);

export const expenseSplits = pgTable(
  "expense_split",
  {
    expenseId: text("expense_id")
      .notNull()
      .references(() => expenses.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => tripMembers.id),
    /**
     * What the user entered: 1 for equal splits, the share count for share
     * splits, or minor units of the expense currency for exact splits.
     */
    weight: bigint("weight", { mode: "number" }).notNull(),
    /** This member's portion, in minor units of the trip base currency. */
    baseAmount: bigint("base_amount", { mode: "number" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.expenseId, t.memberId] })],
);

/** A direct payment between members to settle up (in trip base currency). */
export const settlements = pgTable(
  "settlement",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    fromMemberId: text("from_member_id")
      .notNull()
      .references(() => tripMembers.id),
    toMemberId: text("to_member_id")
      .notNull()
      .references(() => tripMembers.id),
    amount: bigint("amount", { mode: "number" }).notNull(),
    date: date("date").notNull(),
    note: text("note"),
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("settlement_trip_idx").on(t.tripId)],
);

export const eventEntity = pgEnum("event_entity", ["trip", "member", "expense", "settlement"]);
export const eventAction = pgEnum("event_action", ["created", "updated", "deleted", "restored"]);

/**
 * Append-only audit log. `before`/`after` hold full snapshots of the entity
 * (see lib/history.ts), so edits can be inspected and deletions undone.
 */
export const tripEvents = pgTable(
  "trip_event",
  {
    id: id(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    /** Actor's trip name at the time, kept even if they're later renamed or removed. */
    actorName: text("actor_name").notNull(),
    entity: eventEntity("entity").notNull(),
    entityId: text("entity_id").notNull(),
    action: eventAction("action").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("trip_event_trip_idx").on(t.tripId, t.createdAt),
    index("trip_event_entity_idx").on(t.entityId),
  ],
);

export type Trip = typeof trips.$inferSelect;
export type TripMember = typeof tripMembers.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type Settlement = typeof settlements.$inferSelect;
export type TripEvent = typeof tripEvents.$inferSelect;
