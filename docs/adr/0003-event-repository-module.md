# ADR-0003 — Event repository module (deferred)

**Date:** 2026-11-19  
**Status:** Deferred  
**Strength:** Speculative

## Context

`src/lib/data/events.ts` has two shallow wrappers — `getEventForGate` and `getEventWithTicketTypes` — that duplicate client creation and silent-null error handling. The deletion test says they are shallow: delete both and inline the queries; complexity doesn't concentrate anywhere notable.

The seam is currently **hypothetical** — one adapter (Supabase), no variation across it.

## Decision

**Defer.** Wait until Task 3.1 (admin event dashboard) adds a third query shape. At that point two or more distinct callers with different projection needs justify a real seam.

If a third shape appears: deepen into a single `EventRepository` module with shared error semantics, a typed `EventNotFoundError`, and a consistent null-vs-throw contract.

## Update (2026-11-28)

ADR-0006 gives the admin data modules one error contract: page reads throw `DbFailure`, a missing row is `null`, writes return a reason. The event repository itself is still open (architecture review candidate #3).

## Trigger to revisit

Task 3.1 (`getEventStats`) creates the third query shape. At that point, extract the repository.
