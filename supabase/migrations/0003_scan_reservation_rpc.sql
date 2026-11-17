-- Unique constraint: one scan log per reservation (enforces atomicity in scan_reservation RPC)
ALTER TABLE scan_logs ADD CONSTRAINT scan_logs_reservation_id_key UNIQUE (reservation_id);

-- scan_reservation: atomic gate scan
-- Validates PIN, checks reservation status, inserts scan_log with ON CONFLICT DO NOTHING,
-- and returns a full jsonb payload so the caller needs zero follow-up queries.
CREATE OR REPLACE FUNCTION scan_reservation(
  p_reservation_id text,
  p_event_id       uuid,
  p_gate_pin       text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event       record;
  v_reservation record;
  v_items       jsonb;
  v_rows        int;
  v_scanned_at  timestamptz;
BEGIN
  -- Validate event + gate PIN
  SELECT id, gate_pin INTO v_event
    FROM events WHERE id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'not_found');
  END IF;

  IF v_event.gate_pin != p_gate_pin THEN
    RETURN jsonb_build_object('code', 'invalid_pin');
  END IF;

  -- Fetch reservation
  SELECT id, event_id, buyer_name, buyer_email, buyer_phone, status
    INTO v_reservation
    FROM reservations WHERE id = p_reservation_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('code', 'not_found');
  END IF;

  IF v_reservation.event_id != p_event_id THEN
    RETURN jsonb_build_object('code', 'wrong_event');
  END IF;

  IF v_reservation.status = 'void' THEN
    RETURN jsonb_build_object('code', 'voided');
  END IF;

  -- Fetch items with ticket type names
  SELECT jsonb_agg(
    jsonb_build_object(
      'ticket_type_name', tt.name,
      'quantity',         ri.quantity
    ) ORDER BY tt.sort_order
  )
  INTO v_items
  FROM reservation_items ri
  JOIN ticket_types tt ON tt.id = ri.ticket_type_id
  WHERE ri.reservation_id = p_reservation_id;

  -- Atomic check-and-insert: ON CONFLICT fires if already scanned
  INSERT INTO scan_logs (reservation_id, confirmed)
  VALUES (p_reservation_id, true)
  ON CONFLICT (reservation_id) DO NOTHING;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows = 0 THEN
    -- Conflict fired — already admitted; return original scan time
    SELECT scanned_at INTO v_scanned_at
      FROM scan_logs WHERE reservation_id = p_reservation_id;

    RETURN jsonb_build_object(
      'code',           'already_scanned',
      'reservation_id', v_reservation.id,
      'buyer_name',     v_reservation.buyer_name,
      'buyer_email',    v_reservation.buyer_email,
      'buyer_phone',    v_reservation.buyer_phone,
      'items',          COALESCE(v_items, '[]'::jsonb),
      'scanned_at',     v_scanned_at
    );
  END IF;

  RETURN jsonb_build_object(
    'code',           'admitted',
    'reservation_id', v_reservation.id,
    'buyer_name',     v_reservation.buyer_name,
    'buyer_email',    v_reservation.buyer_email,
    'buyer_phone',    v_reservation.buyer_phone,
    'items',          COALESCE(v_items, '[]'::jsonb)
  );
END;
$$;
