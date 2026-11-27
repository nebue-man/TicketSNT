# ADR-0004 — Gate scanning falls back to an on-phone ticket list when offline

**Date:** 2026-11-26
**Status:** Accepted — implemented (migration `0010_gate_offline_mode.sql`)

The server is the source of truth for **Admissions**: `scan_reservation` admits each Reservation exactly once, across every gate, via a unique scan record. For sold-out shows of 2,000–3,000 guests the doors must not stop if mobile data collapses under the crowd, so each gate phone also keeps a downloaded copy of the event's ticket list and, when the server can't be reached, decides **Scan outcomes** on the phone and uploads them when the connection returns. A dedicated gate connection (venue Wi-Fi or a 4G router just for gate phones) remains the primary plan; offline mode is the fallback.

## Considered options

- **Online only** (status quo): exactly-once admission is guaranteed, but a network outage stops the doors entirely.
- **Offline only**: fast and outage-proof, but gates can't see each other's Admissions until they sync, so double entry becomes routine.
- **Online first, offline fallback** (chosen): exactly-once while online; while a phone is offline, the same ticket could be admitted at two gates.

Offline mode is **manual**: gate staff download the **Gate list** before Doors and switch a phone to offline mode with a button. Nothing switches or refreshes automatically, so staff always know which mode a phone is in.

## Consequences

- A **Gate list** (Reservation IDs, buyer names, ticket counts, void status, Admissions so far — no email, phone or NIC) is stored on gate phones during the event and wiped on sign-out or 12 h after Doors.
- The Gate list is a snapshot: offline, a phone knows only the Admissions up to its download plus its own **Offline scans**. Switching to offline tries a quick list update first, and the offline banner always shows the list's age.
- Offline scans are kept on the phone and uploaded only when staff switch back online; the phone stays offline until the upload succeeds. Without the upload, the server would still treat those tickets as unused.
- **Door sales** made while offline are written on paper and entered later as already admitted, so they never appear in a Gate list as unused tickets.
- An offline Admission that the server later finds was already admitted elsewhere is a **double entry**: it can't be undone, only recorded and reported to the organiser.
- Door counts include offline Admissions only after they upload.

## Implementation decisions (2026-11-27)

- **Opens with no connection.** A service worker (`public/gate-sw.js`, scope `/gate/`) caches gate pages (network first, 4 s timeout) and the built JS and QR decoder (cache first), so a Gate phone can reopen the scanner offline once it has loaded it online. Scans and uploads always go to the network.
- **Each Gate phone is named** by staff (e.g. "Gate A") plus a random 4-character id. The name appears in uploads and on the organiser's report.
- **Missing from the Gate list means Not admitted** ("send to the box office"). Every Reservation from the Sales window is in the list, and Door sales are already admitted.
- **Uploading twice is harmless.** If the response is lost and the phone retries, a scan this phone already uploaded comes back `already_uploaded`.
- **Voided after download:** an Offline scan of a Reservation that was voided after the list was downloaded is reported (`voided`) but doesn't count as an Admission.
- **Offline scans survive the wipe.** Sign-out and the 12 h wipe remove the Gate list (buyer names) but keep Offline scans that haven't uploaded. They hold only IDs and times, and losing them would lose Admissions.
- **Organiser's report.** Double entries and voided Offline scans are listed on the admin event dashboard (`offline_scan_issues`).
