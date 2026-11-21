-- Admin read operations as SECURITY DEFINER functions.
-- These bypass RLS so they work regardless of which JWT is presented,
-- matching the same pattern as the write RPCs in 0006.
-- Also adds failsafe anon read policies in case 0005 was partially applied.

-- ── Events ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_all_events()
RETURNS SETOF events
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM events ORDER BY date_time DESC;
$$;
GRANT EXECUTE ON FUNCTION admin_get_all_events TO anon;

CREATE OR REPLACE FUNCTION admin_get_event(p_id uuid)
RETURNS SETOF events
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM events WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION admin_get_event TO anon;

-- ── Ticket types ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_get_tiers(p_event_id uuid)
RETURNS SETOF ticket_types
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM ticket_types WHERE event_id = p_event_id ORDER BY sort_order;
$$;
GRANT EXECUTE ON FUNCTION admin_get_tiers TO anon;

CREATE OR REPLACE FUNCTION admin_get_tier(p_id uuid)
RETURNS SETOF ticket_types
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT * FROM ticket_types WHERE id = p_id;
$$;
GRANT EXECUTE ON FUNCTION admin_get_tier TO anon;

-- ── Failsafe anon read policies ───────────────────────────────────────────────
-- Idempotent: only create if missing (protects against 0005 being partially applied).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'events' AND policyname = 'anon_read_events'
  ) THEN
    CREATE POLICY "anon_read_events" ON events FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ticket_types' AND policyname = 'anon_read_ticket_types'
  ) THEN
    CREATE POLICY "anon_read_ticket_types" ON ticket_types FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reservations' AND policyname = 'anon_read_reservations'
  ) THEN
    CREATE POLICY "anon_read_reservations" ON reservations FOR SELECT TO anon USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'reservation_items' AND policyname = 'anon_read_reservation_items'
  ) THEN
    CREATE POLICY "anon_read_reservation_items" ON reservation_items FOR SELECT TO anon USING (true);
  END IF;
END $$;
