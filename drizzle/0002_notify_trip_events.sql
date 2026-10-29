-- Broadcast every logged change so open pages can refresh live (see lib/realtime.ts).
-- NOTIFY is delivered on commit, so listeners never see rolled-back changes.
CREATE OR REPLACE FUNCTION notify_trip_event() RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('trip_events', json_build_object(
    'tripId', NEW.trip_id,
    'actorUserId', NEW.actor_user_id,
    'actorName', NEW.actor_name,
    'entity', NEW.entity,
    'action', NEW.action
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER trip_event_notify AFTER INSERT ON trip_event
  FOR EACH ROW EXECUTE FUNCTION notify_trip_event();
