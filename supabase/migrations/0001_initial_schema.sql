-- Enable uuid generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE event_status AS ENUM ('draft', 'published', 'closed', 'archived');
CREATE TYPE reservation_status AS ENUM ('active', 'void');

-- events
CREATE TABLE events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  date_time       timestamptz NOT NULL,
  venue           text        NOT NULL,
  description     text        NOT NULL,
  cover_image_url text,
  status          event_status NOT NULL DEFAULT 'draft',
  gate_pin        text        NOT NULL,
  max_per_reservation int     NOT NULL DEFAULT 10,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ticket_types
CREATE TABLE ticket_types (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid    NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name       text    NOT NULL,
  price      numeric NOT NULL,
  capacity   int     NOT NULL,
  sold       int     NOT NULL DEFAULT 0,
  sort_order int     NOT NULL DEFAULT 0
);

-- reservations  (id is RES-XXXXXX format, set by application)
CREATE TABLE reservations (
  id          text PRIMARY KEY,
  event_id    uuid    NOT NULL REFERENCES events(id),
  buyer_name  text    NOT NULL,
  buyer_email text    NOT NULL,
  buyer_phone text    NOT NULL,
  status      reservation_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- reservation_items
CREATE TABLE reservation_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id  text NOT NULL REFERENCES reservations(id),
  ticket_type_id  uuid NOT NULL REFERENCES ticket_types(id),
  quantity        int  NOT NULL
);

-- scan_logs
CREATE TABLE scan_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id text        NOT NULL REFERENCES reservations(id),
  scanned_at     timestamptz NOT NULL DEFAULT now(),
  confirmed      boolean     NOT NULL DEFAULT false
);

-- settings (single row, notification email for admin alerts)
CREATE TABLE settings (
  id                 int  PRIMARY KEY DEFAULT 1,
  notification_email text NOT NULL DEFAULT '',
  CONSTRAINT settings_singleton CHECK (id = 1)
);

INSERT INTO settings (id, notification_email) VALUES (1, '')
  ON CONFLICT DO NOTHING;

-- Indexes
CREATE INDEX idx_ticket_types_event_id ON ticket_types(event_id);
CREATE INDEX idx_reservations_event_id ON reservations(event_id);
CREATE INDEX idx_reservation_items_reservation_id ON reservation_items(reservation_id);
CREATE INDEX idx_scan_logs_reservation_id ON scan_logs(reservation_id);
