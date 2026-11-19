# ADR-0001 — Deepen gate.ts into a resolved ScanOutcome module

**Date:** 2026-11-19  
**Status:** Proposed  
**Strength:** Strong

## Context

The `scan_reservation` RPC returns error codes (`invalid_pin`, `not_found`, `voided`, `already_scanned`, `wrong_event`) that are remapped three separate times:

1. `src/lib/data/gate.ts` — maps RPC string codes → TypeScript discriminated union
2. `src/app/api/gate/scan/route.ts` — maps codes → HTTP status codes
3. `src/components/gate/GateScanner.tsx` — maps codes → user-facing messages

The module is **shallow**: its interface encodes the same knowledge as its three callers. Adding a new error code requires editing three files. The error semantics (which codes mean admission denied vs system error) live nowhere authoritatively.

`gate.ts` is the hottest file in the repo (4 commits, including two multi-file refactors). Task 3.2 (reservation voiding) will add further gate-related state.

## Decision

Deepen `gate.ts` into a **scan module** whose interface returns a fully-resolved `ScanOutcome`:

```typescript
type ScanOutcome =
  | { admitted: true; reservationId: string; buyerName: string; alreadyScanned: boolean }
  | { admitted: false; httpStatus: 400 | 401 | 404 | 409; userMessage: string }
```

The scan module owns the full mapping from RPC code to outcome. All three callers collapse to `if (outcome.admitted)`.

## Consequences

- **Locality**: scan error semantics concentrate in one module
- **Leverage**: one interface, three callers gain new error codes for free
- **Testability**: test the scan module once against RPC codes; callers need no error-code tests
- **Interface shrinks**: callers read `outcome.admitted`, not a discriminated union of error strings

## Deferred until

After Task 3.2 (reservations list + void) is complete — that task may surface additional scan-related state that should be part of the deepened interface.
