-- Offline gate mode (ADR-0004).
--
-- A Gate phone downloads a Gate list before Doors. When staff switch it to
-- offline mode it decides Scan outcomes from that list, keeps its Offline scans,
-- and uploads them when staff switch back online. An Offline scan of a
-- Reservation that was already admitted elsewhere is a Double entry: it can't be
-- undone, only recorded here and reported to the organiser.
--
-- Run AFTER 0009. Safe to run more than once. Run in the Supabase SQL editor.

-- Which Admissions were Offline scans, and from which Gate phone.
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS offline    boolean NOT NULL DEFAULT false;
ALTER TABLE scan_logs ADD COLUMN IF NOT EXISTS gate_phone text;

-- Offline scans the server could not turn into an Admission.
CREATE TABLE IF NOT EXISTS offline_scan_issues (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            uuid        NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reservation_id      text        NOT NULL REFERENCES reservations(id),
  issue               text        NOT NULL CHECK (issue IN ('double_entry', 'voided')),
  gate_phone          text        NOT NULL,
  offline_scanned_at  timestamptz NOT NULL,
  original_scanned_at timestamptz,          -- the Admission it clashed with (double_entry)
  original_source     text,
  original_gate_phone text,
  uploaded_at         timestamptz NOT NULL DEFAULT now(),
  -- A phone may upload the same batch twice (lost response); record it once.
  UNIQUE (reservation_id, gate_phone, offline_scanned_at)
);
CREATE INDEX IF NOT EXISTS idx_offline_scan_issues_event_id ON offline_scan_issues(event_id);

ALTER TABLE offline_scan_issues ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON offline_scan_issues FROM anon, authenticated;

-- The Gate list for one event: every Reservation with buyer name, tickets, void
-- status and Admission time so far. No email, phone or NIC.
CREATE OR REPLACE FUNCTION gate_get_list(p_event_id uuid, p_gate_pin text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event record;
BEGIN
  SELECT id, gate_pin, date_time INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'not_found');
  END IF;
  IF v_event.gate_pin != p_gate_pin THEN
    RETURN jsonb_build_object('code', 'invalid_pin');
  END IF;

  RETURN jsonb_build_object(
    'code',         'ok',
    'event_id',     v_event.id,
    'doors_at',     v_event.date_time,
    'generated_at', now(),
    'reservations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id',          r.id,
               'buyer_name',  r.buyer_name,
               'void',        r.status = 'void',
               'admitted_at', sl.scanned_at,
               'items',       COALESCE((
                 SELECT jsonb_agg(jsonb_build_object('ticket_type_name', tt.name, 'quantity', ri.quantity)
                                  ORDER BY tt.sort_order)
                   FROM reservation_items ri
                   JOIN ticket_types tt ON tt.id = ri.ticket_type_id
                  WHERE ri.reservation_id = r.id), '[]'::jsonb)
             ) ORDER BY r.id)
        FROM reservations r
        LEFT JOIN scan_logs sl ON sl.reservation_id = r.id
       WHERE r.event_id = p_event_id
    ), '[]'::jsonb)
  );
END;
$$;

-- Uploads a Gate phone's Offline scans: [{ "reservation_id": "RES-…", "scanned_at": "…" }].
-- Each becomes an Admission, unless the Reservation was already admitted (Double
-- entry) or voided. Re-uploading the same scans is harmless.
-- Result per scan: recorded | already_uploaded | double_entry | voided | rejected.
CREATE OR REPLACE FUNCTION gate_upload_offline_scans(
  p_event_id   uuid,
  p_gate_pin   text,
  p_gate_phone text,
  p_scans      jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event    record;
  v_scan     jsonb;
  v_id       text;
  v_at       timestamptz;
  v_res      record;
  v_existing record;
  v_rows     int;
  v_result   text;
  v_results  jsonb := '[]'::jsonb;
BEGIN
  SELECT id, gate_pin INTO v_event FROM events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'not_found');
  END IF;
  IF v_event.gate_pin != p_gate_pin THEN
    RETURN jsonb_build_object('code', 'invalid_pin');
  END IF;
  IF coalesce(trim(p_gate_phone), '') = '' OR jsonb_typeof(p_scans) IS DISTINCT FROM 'array' THEN
    RETURN jsonb_build_object('code', 'invalid_input');
  END IF;

  FOR v_scan IN SELECT * FROM jsonb_array_elements(p_scans) LOOP
    v_id := upper(trim(v_scan->>'reservation_id'));
    BEGIN
      v_at := (v_scan->>'scanned_at')::timestamptz;
    EXCEPTION WHEN others THEN
      v_at := NULL;
    END;

    SELECT id, status INTO v_res FROM reservations WHERE id = v_id AND event_id = p_event_id;

    IF v_at IS NULL OR NOT FOUND THEN
      v_result := 'rejected';
    ELSIF v_res.status = 'void' THEN
      INSERT INTO offline_scan_issues (event_id, reservation_id, issue, gate_phone, offline_scanned_at)
      VALUES (p_event_id, v_id, 'voided', p_gate_phone, v_at)
      ON CONFLICT (reservation_id, gate_phone, offline_scanned_at) DO NOTHING;
      v_result := 'voided';
    ELSE
      INSERT INTO scan_logs (reservation_id, confirmed, source, scanned_at, offline, gate_phone)
      VALUES (v_id, true, 'gate', v_at, true, p_gate_phone)
      ON CONFLICT (reservation_id) DO NOTHING;
      GET DIAGNOSTICS v_rows = ROW_COUNT;

      IF v_rows = 1 THEN
        v_result := 'recorded';
      ELSE
        SELECT scanned_at, source, offline, gate_phone INTO v_existing
          FROM scan_logs WHERE reservation_id = v_id;
        IF v_existing.offline AND v_existing.gate_phone = p_gate_phone AND v_existing.scanned_at = v_at THEN
          v_result := 'already_uploaded';
        ELSE
          INSERT INTO offline_scan_issues (event_id, reservation_id, issue, gate_phone, offline_scanned_at,
                                           original_scanned_at, original_source, original_gate_phone)
          VALUES (p_event_id, v_id, 'double_entry', p_gate_phone, v_at,
                  v_existing.scanned_at, v_existing.source, v_existing.gate_phone)
          ON CONFLICT (reservation_id, gate_phone, offline_scanned_at) DO NOTHING;
          v_result := 'double_entry';
        END IF;
      END IF;
    END IF;

    v_results := v_results || jsonb_build_object('reservation_id', v_id, 'result', v_result);
  END LOOP;

  RETURN jsonb_build_object('code', 'ok', 'results', v_results);
END;
$$;

-- Offline scan issues for the organiser's event dashboard, newest first.
CREATE OR REPLACE FUNCTION admin_get_offline_scan_issues(p_event_id uuid)
RETURNS TABLE (
  reservation_id      text,
  buyer_name          text,
  tickets             int,
  issue               text,
  gate_phone          text,
  offline_scanned_at  timestamptz,
  original_scanned_at timestamptz,
  original_source     text,
  original_gate_phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT i.reservation_id, r.buyer_name,
         COALESCE((SELECT SUM(ri.quantity) FROM reservation_items ri WHERE ri.reservation_id = i.reservation_id), 0)::int,
         i.issue, i.gate_phone, i.offline_scanned_at,
         i.original_scanned_at, i.original_source, i.original_gate_phone
    FROM offline_scan_issues i
    JOIN reservations r ON r.id = i.reservation_id
   WHERE i.event_id = p_event_id
   ORDER BY i.offline_scanned_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION gate_get_list(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION gate_upload_offline_scans(uuid, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_get_offline_scan_issues(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION gate_get_list(uuid, text) TO service_role;
GRANT  EXECUTE ON FUNCTION gate_upload_offline_scans(uuid, text, text, jsonb) TO service_role;
GRANT  EXECUTE ON FUNCTION admin_get_offline_scan_issues(uuid) TO service_role;
