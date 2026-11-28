# ADR-0005 — One gate-scan module owns the Scan outcome

**Date:** 2026-11-28
**Status:** Accepted — supersedes ADR-0001

The meaning of a **Scan outcome** had spread across six places: the server's code mapping, the scan route's HTTP statuses, the Door count rule in the route, the phone's error messages, the Gate list's own offline messages, and the offline hook. The phone also read hidden rules off the wire (a missing `doorCount` meant "wrong PIN", `null` meant "unavailable"). One gate-scan module (`src/lib/gate-scan/`) now owns it, on both sides of the wire:

- `outcome.ts`: the Scan outcome (Admitted, Already scanned, Not admitted with a reason, **Not checked**), the staff-facing words for every Not admitted reason, and the wire shape with a strict parser.
- The server half (`decideScan` in `src/lib/data/gate.ts`) turns a database answer into that shape.
- The phone half (`scanner.ts`) turns any Scan, whether online, offline or unanswered, into one Scan outcome plus the Door count to show. The network and offline mode come in as adapters. GateScanner only draws the screen.

## Wire contract

`POST /api/gate/scan-outcome` answers **HTTP 200 for every Scan the server decided**, including Not admitted and a wrong gate PIN, with the outcome named in the body: `{ outcome, reason?, reservation?, admittedAt?, doorCount: live | unavailable | withheld }`. Any other status, or a 200 body that doesn't parse, means nothing was decided, and the phone shows Not checked. A wrong gate PIN gets `doorCount: withheld`, so no event numbers are revealed.

## Considered options

- **Keep HTTP statuses for Not admitted** (403/404/400): the phone has to decode status codes back into reasons, and "did the server decide?" gets mixed up with "was the guest let in?".
- **Client-only module over the old wire**: the hidden missing-vs-null rule just moves inside the module instead of going away.
- **200 for every decided Scan, explicit outcome** (chosen): the phone reads meaning directly; non-200 has one meaning.

## Consequences

- **New path, old one kept.** A gate page left open across a deploy runs old code that treats any 200 as Admitted. If the old `/api/gate/scan` changed shape, a voided ticket would show green on such a phone. So the new contract lives at `/api/gate/scan-outcome`, and `/api/gate/scan` stays unchanged until after the next show, then gets deleted.
- A database failure before a decision now shows **Not checked** (with Retry and Switch to offline mode) instead of "Not admitted · Something went wrong".
- The Gate list and offline upload routes keep their own wire format. They don't produce Scan outcomes.
