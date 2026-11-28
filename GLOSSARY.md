# SNT Tickets

Ticket reservations for SNT Entertainment events, and checking those tickets at the venue gate.

## Language

### Tickets

**Reservation**:
One buyer's booking of one or more tickets for one event, identified by a Reservation ID (`RES-XXXXXX`) that its QR encodes. The whole group is expected to arrive together.
_Avoid_: Booking, order, ticket (when meaning the whole group)

### Gate

**Scan**:
One reading of a ticket QR (or a typed Reservation ID) by gate staff at an event's gate.
_Avoid_: Check, read, lookup

**Admission**:
The moment a **Reservation** is let in, admitting every ticket in it at once: its first successful **Scan**, or the **Door sale** itself.
_Avoid_: Check-in, redeem, entry

**Door sale**:
A **Reservation** sold at the venue box office during **Doors**; the sale is its **Admission**. Sales made while offline are recorded on paper and entered later, already admitted, at the time written down.
_Avoid_: Walk-up, box office ticket

**Re-scan**:
Any **Scan** of a **Reservation** that already has an **Admission**; shown with the time of the original Admission.
_Avoid_: Duplicate, double scan

**Scan outcome**:
What the gate screen shows after a **Scan**: Admitted, Already scanned (a **Re-scan**), or Not admitted with a reason.
_Avoid_: QR result, scan result

**Gate phone**:
A phone used by gate staff to **Scan** tickets for one event; plan one per 400 guests plus spares.
_Avoid_: Scanner, device, gate device

**Gate list**:
The snapshot of an event's **Reservations** and **Admissions** that gate staff download to a **Gate phone** before **Doors**, used only in offline mode.
_Avoid_: Offline list, cache, ticket list

**Offline scan**:
A **Scan** decided on the **Gate phone** from its **Gate list**, made while staff have switched the phone to offline mode; it reaches the server only when staff switch the phone back online.
_Avoid_: Local scan, cached scan

**Double entry**:
An **Offline scan** that admitted a **Reservation** which another **Gate phone** had already admitted.
_Avoid_: Conflict, duplicate

**Door count**:
The number of guests admitted so far for an event, counting every ticket in each admitted **Reservation**. A **Gate phone** in offline mode shows only an approximate Door count: what its **Gate list** knew plus its own **Offline scans**, so it misses other Gate phones' **Offline scans**.
_Avoid_: Attendance, check-in count

### Event lifecycle

**Sales window**:
The period during which a **Reservation** can be made for an event; the system must be fully online throughout it.
_Avoid_: Booking period, on-sale

**Doors**:
The period on show night when **Gate phones** are scanning guests in.
_Avoid_: Check-in, entry window
