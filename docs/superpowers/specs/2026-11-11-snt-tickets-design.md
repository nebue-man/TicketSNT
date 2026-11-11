# SNT Ticket Platform — Full Spec

> Source: structured requirements grilling session, November 2026.
> All 41 design decisions settled. Ready for implementation.

---

## Overview

Standalone ticket reservation platform for SNT Entertainment at `tickets.sntentertainments.com`.
Buyers reserve tickets online via a form, receive a QR code, and show it at the gate. Gate workers
scan to verify, collect physical payment, then confirm entry. No online payments, no buyer accounts.

Stack: Next.js (App Router) + TypeScript · Supabase (Postgres) · Resend · Vercel

---

## Core Buyer Flow

1. Click "Buy tickets" on sntentertainments.com → land on `/reserve/[eventId]`
2. Fill form: name, email, phone, ticket type(s) + quantities, consent checkbox
3. Submit → QR shown on-screen immediately + confirmation email sent
4. At gate: show QR → worker scans → worker collects cash → worker taps Confirm Entry → QR consumed

---

## Data Model

### events
| field | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| date_time | timestamptz | |
| venue | text | |
| description | text | |
| cover_image_url | text nullable | |
| status | enum | draft \| published \| closed \| archived |
| gate_pin | text | 6-digit, hashed |
| max_per_reservation | int | default 10 |
| created_at | timestamptz | |

### ticket_types
| field | type | notes |
|---|---|---|
| id | uuid PK | |
| event_id | uuid FK → events | |
| name | text | e.g. "General", "VIP" |
| price | numeric | reference price, display only |
| capacity | int | |
| sold | int | incremented on reservation |
| sort_order | int | |

### reservations
| field | type | notes |
|---|---|---|
| id | text PK | format: RES-XXXXXX (uppercase hex) |
| event_id | uuid FK → events | |
| buyer_name | text | |
| buyer_email | text | |
| buyer_phone | text | |
| status | enum | active \| void |
| created_at | timestamptz | |

### reservation_items
| field | type | notes |
|---|---|---|
| id | uuid PK | |
| reservation_id | text FK → reservations | |
| ticket_type_id | uuid FK → ticket_types | |
| quantity | int | |

### scan_logs
| field | type | notes |
|---|---|---|
| id | uuid PK | |
| reservation_id | text FK → reservations | |
| scanned_at | timestamptz | |
| confirmed | boolean | false = scanned only, true = entry confirmed |

---

## Page Map

| Route | Who | Purpose |
|---|---|---|
| `/reserve/[eventId]` | Buyer | Reservation form |
| `/ticket/[reservationId]` | Buyer | QR + booking summary (persistent) |
| `/resend-ticket` | Buyer | Re-send QR to email |
| `/gate/[eventId]` | Gate worker | PIN login + scanner |
| `/admin` | SNT staff | Login |
| `/admin/events` | SNT staff | Event list |
| `/admin/events/new` | SNT staff | Create event |
| `/admin/events/[id]` | SNT staff | Edit event |
| `/admin/events/[id]/reservations` | SNT staff | Reservations + scan log |
| `/admin/settings` | SNT staff | Notification email |

---

## Key Behaviours

### Capacity & sold-out
- Each ticket type has individual capacity. `sold` increments atomically on reservation.
- When a type hits capacity: removed from the reservation form.
- When all types are sold out: form replaced with full Sold Out page.

### QR code
- Encodes reservation ID only (e.g. `RES-7F3A9C`). No personal data.
- Single-use: Confirm Entry sets `scan_logs.confirmed = true`.
- Second scan of same ID → ALREADY SCANNED + first-scan timestamp.
- Voided or unknown → INVALID.

### Gate app
- PIN is bcrypt-hashed in DB. Worker enters PIN → JWT stored in sessionStorage for the event.
- Scanner uses device camera. Online-only (no offline mode).
- Confirm Entry is the only write action; scan alone does not consume the QR.

### Admin
- Single shared login (bcrypt password in env var, no DB user table needed).
- Void sets `reservations.status = 'void'`.
- CSV export: name, email, phone, ticket types + counts, reserved_at, scan status.
- Notification email sent via Resend to address stored in a `settings` table (1-row).

### Email (Resend)
Confirmation email contains: event name/date/venue, QR inline image, reservation ID,
ticket summary, buyer name, gate instructions, link to `/ticket/[id]`, link to `/resend-ticket`.
Resend trigger: SNT notification email on every new reservation.

---

## Build Slices

| Slice | Contents | Est. tokens |
|---|---|---|
| **A1 — Foundation** | Next.js scaffold, Tailwind, folder structure, Supabase schema + migrations, TypeScript types, `.env.example` | ~25K |
| **B1 — Reservation form** | `/reserve/[eventId]`, ticket selector (mixed types), capacity check, form → DB, sold-out states | ~45K |
| **B2 — Ticket delivery** | QR generation, `/ticket/[reservationId]`, Resend email template, `/resend-ticket` | ~35K |
| **C1 — Gate app** | PIN auth, camera scanner, scan API, result display, Confirm Entry | ~45K |
| **D1 — Admin: events** | Admin login, event list, create/edit form, draft/publish/close/archive | ~45K |
| **D2 — Admin: reservations** | Event detail, reservation list + search, void, CSV export, Settings page | ~35K |

Build order: A1 → B1 → B2 → C1 → D1 → D2

---

## Out of Scope

Online payment · buyer accounts · reserved seating · offline gate scanning ·
self-serve cancellations · SMS · public event listing · role-based admin access · reviews
