-- Door sales and the live Door count.
--
-- A Door sale is a Reservation sold at the venue box office during Doors; the
-- sale itself is its Admission (see GLOSSARY.md). Sales written on paper during
-- an outage are entered later with the time written down (p_admitted_at).
--
-- Run AFTER 0008. Safe to run more than once. Run in the Supabase SQL editor.

-- Where each Admission happened.
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'gate';
ALTER TABLE scan_logs DROP CONSTRAINT IF EXISTS scan_logs_source_check;
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_source_check CHECK (source IN ('gate', 'box_office'));

-- Creates the Reservation and its Admission in one transaction: a Door sale can
-- never exist without being admitted.
CREATE OR REPLACE FUNCTION create_door_sale(
  p_id          text,
  p_event_id    uuid,
  p_buyer_name  text,
  p_buyer_email text,
  p_buyer_phone text,
  p_buyer_nic   text,
  p_items       jsonb,
  p_admitted_at timestamptz DEFAULT NULL
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM create_reservation(p_id, p_event_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_buyer_nic, p_items);

  INSERT INTO scan_logs (reservation_id, confirmed, source, scanned_at)
  VALUES (p_id, true, 'box_office', COALESCE(p_admitted_at, now()));

  RETURN p_id;
END;
$$;

-- Door count for one event: tickets admitted vs tickets sold, split by where
-- the Admission happened. Every ticket in an admitted Reservation counts.
CREATE OR REPLACE FUNCTION admin_get_door_count(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH per_reservation AS (
    SELECT r.id,
           r.status,
           sl.source,
           COALESCE((SELECT SUM(ri.quantity) FROM reservation_items ri WHERE ri.reservation_id = r.id), 0) AS tickets
      FROM reservations r
      LEFT JOIN scan_logs sl ON sl.reservation_id = r.id
     WHERE r.event_id = p_event_id
  )
  SELECT jsonb_build_object(
    'tickets_sold',              COALESCE(SUM(tickets) FILTER (WHERE status = 'active'), 0),
    'tickets_admitted',          COALESCE(SUM(tickets) FILTER (WHERE source IS NOT NULL), 0),
    'tickets_admitted_gate',     COALESCE(SUM(tickets) FILTER (WHERE source = 'gate'), 0),
    'tickets_admitted_box_office', COALESCE(SUM(tickets) FILTER (WHERE source = 'box_office'), 0),
    'reservations_admitted',     COUNT(*) FILTER (WHERE source IS NOT NULL)
  )
  FROM per_reservation;
$$;

REVOKE EXECUTE ON FUNCTION create_door_sale(text, uuid, text, text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_get_door_count(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION create_door_sale(text, uuid, text, text, text, text, jsonb, timestamptz) TO service_role;
GRANT  EXECUTE ON FUNCTION admin_get_door_count(uuid) TO service_role;
