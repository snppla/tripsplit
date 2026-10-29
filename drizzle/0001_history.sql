CREATE TYPE "public"."event_action" AS ENUM('created', 'updated', 'deleted', 'restored');--> statement-breakpoint
CREATE TYPE "public"."event_entity" AS ENUM('trip', 'member', 'expense', 'settlement');--> statement-breakpoint
CREATE TABLE "trip_event" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"entity" "event_entity" NOT NULL,
	"entity_id" text NOT NULL,
	"action" "event_action" NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trip_event" ADD CONSTRAINT "trip_event_trip_id_trip_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trip"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trip_event" ADD CONSTRAINT "trip_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trip_event_trip_idx" ON "trip_event" USING btree ("trip_id","created_at");--> statement-breakpoint
CREATE INDEX "trip_event_entity_idx" ON "trip_event" USING btree ("entity_id");