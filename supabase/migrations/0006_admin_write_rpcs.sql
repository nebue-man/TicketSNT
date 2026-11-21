-- Admin write operations as SECURITY DEFINER functions.
-- These bypass RLS so they work regardless of which JWT is presented,
-- matching the same pattern as create_reservation and scan_reservation.

GRANT EXECUTE ON FUNCTION create_reservation TO anon;

-- ── Events ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_create_event(
  p_name               text,
  p_date_time          timestamptz,
  p_venue              text,
  p_description        text,
  p_cover_image_url    text,
  p_max_per_reservation int,
  p_gate_pin           text,
  p_status             event_status
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO events (name, date_time, venue, description, cover_image_url, max_per_reservation, gate_pin, status)
  VALUES (p_name, p_date_time, p_venue, p_description, p_cover_image_url, p_max_per_reservation, p_gate_pin, p_status)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_create_event TO anon;

CREATE OR REPLACE FUNCTION admin_update_event(
  p_id                 uuid,
  p_name               text,
  p_date_time          timestamptz,
  p_venue              text,
  p_description        text,
  p_cover_image_url    text,
  p_max_per_reservation int,
  p_gate_pin           text,
  p_status             event_status
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE events SET
    name                 = p_name,
    date_time            = p_date_time,
    venue                = p_venue,
    description          = p_description,
    cover_image_url      = p_cover_image_url,
    max_per_reservation  = p_max_per_reservation,
    gate_pin             = p_gate_pin,
    status               = p_status
  WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_event TO anon;

CREATE OR REPLACE FUNCTION admin_close_event(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE events SET status = 'closed' WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_close_event TO anon;

-- ── Ticket types ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_create_tier(
  p_event_id   uuid,
  p_name       text,
  p_price      numeric,
  p_capacity   int,
  p_sort_order int
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO ticket_types (event_id, name, price, capacity, sort_order, sold)
  VALUES (p_event_id, p_name, p_price, p_capacity, p_sort_order, 0)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_create_tier TO anon;

CREATE OR REPLACE FUNCTION admin_update_tier(
  p_id       uuid,
  p_name     text,
  p_price    numeric,
  p_capacity int
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sold int;
BEGIN
  SELECT sold INTO v_sold FROM ticket_types WHERE id = p_id;
  IF p_capacity < v_sold THEN
    RETURN 'capacity_too_low:' || v_sold::text;
  END IF;
  UPDATE ticket_types SET name = p_name, price = p_price, capacity = p_capacity WHERE id = p_id;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION admin_update_tier TO anon;

CREATE OR REPLACE FUNCTION admin_delete_tier(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_sold int;
BEGIN
  SELECT sold INTO v_sold FROM ticket_types WHERE id = p_id;
  IF v_sold > 0 THEN RETURN 'has_bookings'; END IF;
  DELETE FROM ticket_types WHERE id = p_id;
  RETURN 'ok';
END;
$$;
GRANT EXECUTE ON FUNCTION admin_delete_tier TO anon;

-- ── Reservations ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION admin_void_reservation(p_id text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE reservations SET status = 'void' WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION admin_void_reservation TO anon;
