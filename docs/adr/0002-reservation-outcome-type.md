# ADR-0002 — Typed ReservationOutcome at the data-layer seam

**Date:** 2026-11-19  
**Status:** Proposed  
**Strength:** Worth exploring

## Context

Three modules each speak a different error dialect across the reservation flow:

- `src/lib/utils/validate-reservation.ts` — returns plain English strings
- `src/lib/data/reservations.ts` — parses RPC error messages with `error.message.includes('capacity_exceeded')`
- `src/app/api/reserve/route.ts` — checks Supabase error codes (`PGRST116`)

Errors cross seams as `string | null`. The route contains Supabase-specific knowledge (`PGRST116`) that should stay behind the data-layer seam. Adding a new failure mode (e.g., event closed, duplicate booking) requires editing all three modules.

## Decision

Deepen `reservations.ts` to return a typed `ReservationOutcome` discriminant:

```typescript
type ReservationOutcome =
  | { ok: true; reservationId: string }
  | { ok: false; reason: 'capacity_exceeded' | 'ticket_type_not_found' | 'event_not_found' | 'db_error' }
```

The data layer absorbs all Supabase error dialect. The route collapses to a switch on `outcome.reason` with no PGRST codes or string parsing.

## Consequences

- **Locality**: Supabase error dialect stays behind the data-layer seam
- **Interface shrinks**: route reads a typed discriminant, not a stringly-typed error
- **Testability**: reservation module testable with a fake that returns outcomes directly — no Supabase mock needed

## Deferred until

After the admin data layer (Tasks 2.2–2.4) is built — if that layer follows the same pattern it creates a natural moment to standardise across both.
