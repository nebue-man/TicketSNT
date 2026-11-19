-- Enable RLS on all tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_items ENABLE ROW LEVEL SECURITY;

-- Anon can read published events and their ticket types (counter homepage + reserve page)
CREATE POLICY "anon_read_events"
  ON events FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "anon_read_ticket_types"
  ON ticket_types FOR SELECT
  TO anon
  USING (true);

-- All writes on reservations and reservation_items go through SECURITY DEFINER RPCs
-- (create_reservation, scan_reservation) which run as the function owner, bypassing RLS.
-- No direct anon write policies needed.

-- service_role bypasses RLS entirely — admin client writes work without additional policies.
