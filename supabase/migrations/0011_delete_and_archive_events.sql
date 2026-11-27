-- Delete and archive events.
--
-- Delete is for an event made by mistake: it only works while the event has no
-- Reservations at all (online, door sales or voided), so no buyer, scan or
-- door-count record ever loses its event. Its ticket tiers go with it.
--
-- Archive is for an event that has ended: it hides the event from the admin
-- list but keeps everything. Restore brings it back as 'closed', so restoring
-- never reopens sales.
--
-- Safe to run more than once. Run in the Supabase SQL editor.

CREATE OR REPLACE FUNCTION admin_delete_event(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Lock the event row: a Reservation being created at the same moment holds a
  -- key-share lock on it, so we wait for it and then see it below.
  PERFORM 1 FROM events WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF EXISTS (SELECT 1 FROM reservations WHERE event_id = p_id) THEN
    RETURN 'has_reservations';
  END IF;
  DELETE FROM events WHERE id = p_id;  -- ticket_types cascade
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION admin_archive_event(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE events SET status = 'archived' WHERE id = p_id;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  RETURN 'ok';
END;
$$;

CREATE OR REPLACE FUNCTION admin_restore_event(p_id uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_status event_status;
BEGIN
  SELECT status INTO v_status FROM events WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RETURN 'not_found'; END IF;
  IF v_status <> 'archived' THEN RETURN 'not_archived'; END IF;
  UPDATE events SET status = 'closed' WHERE id = p_id;
  RETURN 'ok';
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_delete_event(uuid)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_archive_event(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION admin_restore_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION admin_delete_event(uuid)  TO service_role;
GRANT  EXECUTE ON FUNCTION admin_archive_event(uuid) TO service_role;
GRANT  EXECUTE ON FUNCTION admin_restore_event(uuid) TO service_role;
