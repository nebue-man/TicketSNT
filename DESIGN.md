# SNT Ticket Platform — Design Document

> Design decisions produced through structured requirements grilling, November 2026.
> This document is the single source of truth before implementation begins.

---

## Overview

A standalone ticket reservation platform for SNT Entertainment. Buyers click "Buy tickets" on sntentertainments.com, land on the platform, fill a reservation form, and receive a QR code. Gate workers scan the QR at entry, collect physical payment, and confirm entry. No online payments. No buyer accounts.

Hosted at `tickets.sntentertainments.com`.

---

## Core Buyer Flow

1. Buyer arrives via direct link from sntentertainments.com (one link per event)
2. Fills reservation form: name, email, phone, ticket type(s) + counts, consent checkbox
3. QR code shown on-screen immediately + emailed as backup
4. Buyer visits the gate, shows QR (from screen or email)
5. Gate worker scans QR → sees name, ticket type(s), count
6. Worker collects physical payment
7. Worker taps **Confirm Entry** → QR is consumed (single-use)

---

## Decisions

### Payment
- **Physical at the gate only.** No payment gateway. No online transactions.
- The QR is a reservation token, not a receipt of payment.

### Buyer Accounts
- **Guest checkout only.** No accounts, no passwords.
- Identity = name + email + phone, captured once per reservation.

### Events
- **Multi-event platform.** SNT runs multiple events; one platform serves all.
- Each event has: name, date/time, venue, short description, optional cover image.
- Events are created as **drafts** and published when ready to accept reservations.
- Admin can **close reservations early** at any time before the event.
- Events are **auto-archived** after their date passes (still viewable with full logs).

### Ticket Types
- Defined **per event** by the admin — each event sets its own types (e.g. General, VIP).
- Each ticket type has: name, reference price (shown to buyer), individual capacity, max-per-reservation limit (default: 10).
- **Mixed reservations allowed** — one form submission can include multiple ticket types (e.g. 2 VIP + 3 General).
- One QR covers the entire reservation regardless of how many types are included.

### Capacity
- **Hard cap per ticket type.** Reservations auto-close when a type hits capacity.
- When a ticket type sells out: it disappears from the reservation form.
- When all ticket types are sold out: the entire form is replaced with a **Sold Out page**.

### QR Code
- Encodes the **reservation ID only** (e.g. `RES-7F3A9C`). No personal data in the QR.
- Server validates on scan — online-only, no offline mode.
- **Single-use** — consumed on first successful Confirm Entry tap.
- Subsequent scans of a used QR show: red **ALREADY SCANNED** + timestamp of first scan.
- Unknown/invalid reservation IDs show: red **INVALID**.

### Ticket Page
- Persistent page at `/ticket/[reservationId]` — buyer can bookmark and return.
- Shows: QR code, human-readable reservation ID, event details, ticket type + count.
- Linked from the confirmation email.

### Confirmation Email
- Sent via **Resend** immediately after reservation.
- Contains: event name, date, venue, QR code (inline image), reservation ID, ticket type + count, buyer name, "Show this at the gate" instructions, link to ticket page, link to resend page.

### Lost QR — Self-Serve Resend
- Page at `/resend-ticket`.
- Buyer enters: email address + last 4 digits of phone number.
- System re-sends the original QR (same reservation ID, not regenerated) to their inbox.
- Covers lost email, phone death, etc. without gate worker involvement.

### Cancellations
- **No self-serve cancellations.**
- Buyer contacts SNT directly. Admin voids the QR manually from the dashboard.
- Voided QR shows as INVALID at the gate.

### Gate Scanning App
- Mobile web app — gate workers open a URL on their phone, no install required.
- Protected by an **event-specific PIN** (6-digit, set by admin at event creation, editable before event date).
- **Online-only** — SNT ensures hotspot/WiFi at entrance.
- Scan flow: camera scans QR → result shown full-screen → worker collects payment → taps Confirm Entry.
- QR consumed on Confirm Entry. All-or-nothing (no partial entry tracking).

### Scan Result Display
| State | Display |
|---|---|
| Valid, not yet scanned | Large green **VALID** banner + buyer name, ticket type(s), count |
| Already scanned | Large red **ALREADY SCANNED** + first-scan timestamp |
| Unknown / voided | Large red **INVALID** |

### Admin Dashboard
- **Single shared login** — one password for all SNT internal staff.
- Screens:
  - **Event list** — all upcoming and past (archived) events
  - **Event detail** — reservation list, scan log, capacity usage
  - **Create / edit event** — all event fields + ticket types + gate PIN
  - **Settings** — SNT notification email address
- Reservation list is **searchable** by buyer name, email, or reservation ID.
- **CSV export** per event: name, email, phone, ticket type, count, reservation time, scan status.
- Admin can **void** any individual reservation from the event detail page.
- Admin can **adjust capacity** per ticket type at any time.

### Admin Notifications
- SNT receives an **email notification per booking** to a configured address (set in Settings).
- Address is editable without redeployment.

### Buyer Consent
- Reservation form includes a **required consent checkbox**: buyer acknowledges their name, email, and phone will be used for event entry purposes.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| Database | Postgres — separate Supabase project (not shared with main SNT app) |
| Email | Resend |
| Hosting | Vercel |
| Domain | `tickets.sntentertainments.com` |

---

## Out of Scope (explicitly decided against)

- Online payment gateway
- Buyer accounts / login
- Reserved seating / seat maps
- Offline gate scanning
- Self-serve cancellations
- SMS notifications
- Public event listing page (discoverability via sntentertainments.com only)
- Role-based admin access (single shared login)
- Customer reviews or testimonials

---

## Open Questions (not yet decided)

- None. All design decisions are settled.
