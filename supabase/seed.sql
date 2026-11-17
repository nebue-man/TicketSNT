-- Seed data for local preview
-- Run with: supabase db reset  (re-runs migrations then this file)
-- Or manually: psql $DATABASE_URL -f supabase/seed.sql

DO $$
DECLARE
  event1_id uuid := 'a1b2c3d4-0001-0001-0001-000000000001';
  event2_id uuid := 'a1b2c3d4-0002-0002-0002-000000000002';
  tt1_ga    uuid := 'b2c3d4e5-0001-0001-0001-000000000001';
  tt1_vip   uuid := 'b2c3d4e5-0001-0001-0001-000000000002';
  tt1_table uuid := 'b2c3d4e5-0001-0001-0001-000000000003';
  tt2_gen   uuid := 'b2c3d4e5-0002-0002-0002-000000000001';
  tt2_vip   uuid := 'b2c3d4e5-0002-0002-0002-000000000002';
BEGIN

  -- ── Event 1: upcoming concert (published) ──────────────────────────────────
  INSERT INTO events (id, name, date_time, venue, description, cover_image_url, status, gate_pin, max_per_reservation)
  VALUES (
    event1_id,
    'Neon Nights Vol. 3',
    now() + interval '14 days',
    'Trace Expert City, Colombo 10',
    'A night of electronic music featuring Sri Lanka''s top DJs.',
    'https://picsum.photos/seed/neon-nights/600/800',
    'published',
    'GATE01',
    6
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO ticket_types (id, event_id, name, price, capacity, sold, sort_order) VALUES
    (tt1_ga,    event1_id, 'General Admission', 2500,  300, 42, 1),
    (tt1_vip,   event1_id, 'VIP Lounge',        6500,   80,  8, 2),
    (tt1_table, event1_id, 'Table (6 persons)', 30000,  20,  2, 3)
  ON CONFLICT (id) DO NOTHING;

  -- ── Event 2: sold-out past event (closed) ──────────────────────────────────
  INSERT INTO events (id, name, date_time, venue, description, status, gate_pin, max_per_reservation)
  VALUES (
    event2_id,
    'Lanka Beats Festival',
    now() - interval '30 days',
    'Viharamahadevi Open Air Theatre, Colombo 07',
    'Annual open-air music festival celebrating local talent.',
    'closed',
    'GATE02',
    4
  ) ON CONFLICT (id) DO NOTHING;

  INSERT INTO ticket_types (id, event_id, name, price, capacity, sold, sort_order) VALUES
    (tt2_gen, event2_id, 'General',  1500, 500, 500, 1),
    (tt2_vip, event2_id, 'VIP',      4000,  50,  50, 2)
  ON CONFLICT (id) DO NOTHING;

  -- ── Sample reservation for Event 1 (pre-scanned, for gate preview) ─────────
  INSERT INTO reservations (id, event_id, buyer_name, buyer_email, buyer_phone, status)
  VALUES ('RES-PREVIEW', event1_id, 'Ashan Fernando', 'ashan@example.com', '+94 77 123 4567', 'active')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
  VALUES ('RES-PREVIEW', tt1_ga, 2)
  ON CONFLICT DO NOTHING;

END $$;
