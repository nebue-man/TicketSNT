# ADR-0006 — One database-call module, tested against the real SQL

**Date:** 2026-11-28  
**Status:** Accepted. Admin data modules moved (PR 1). The rest (`events`, `reservations`, `gate`, `gate-offline`, the reserve route) follow in PR 2. Supersedes the error-dialect part of ADR-0002, and settles ADR-0003's "consistent null-vs-throw contract" for the admin data modules.

Every data module repeated the same steps: create the Supabase client, cast `rpc` to `any`, log the error its own way. They also reported failure six different ways: `null`, `[]`, `false`, `{ error }`, `{ ok, status }`, and parsed strings. As a result, a database outage showed on the dashboard as "No tiers yet" or an empty events list. None of the TypeScript data modules had tests.

## Decision

`callDb(fn, args, refusals?)` in `src/lib/data/db.ts` calls one database function and answers one of three things:

- **ok**: the function answered, with its data. This includes answers such as `'has_bookings'`, `'capacity_too_low:N'` or the gate's `{ code }`, which each data module reads.
- **refused**: the function **raised** an error whose code the caller listed, in the form `code` or `code:detail` (e.g. `capacity_exceeded:<ticket type>`).
- **failed**: anything else. The database couldn't answer.

**Only raised errors can be refusals.** A returned value is the function's answer. A raised error is ambiguous between "refused" and "broken", so the caller must say which codes it expects, and any code it didn't list counts as *failed*. This leaves the existing SQL alone: making every function signal refusals the same way would need migrations run by hand.

Page reads throw `DbFailure` on *failed*, and `src/app/admin/error.tsx` shows "Couldn't reach the database" with Try again. Writes return `{ ok: true } | { ok: false, reason }`. Routes, not data modules, turn a reason into a message and an HTTP status. The Door count is the exception: it stays `null` on failure, because the dashboard and the gate show it as "unavailable" and keep working.

## The seam

`src/lib/data/db-adapter.ts` does only "run this function with these arguments". It has two adapters:

- **Supabase** (`rpc`) in production.
- **In-memory Postgres** (`supabase/tests/db-adapter.ts`, PGlite) in tests. It applies every migration and runs as `service_role`, so a missing permission grant fails in tests as it would on Supabase. It returns `numeric` as a number, as PostgREST does.

Tests replace the adapter module with `vi.mock`. Production code has no test-only hooks.

## Consequences

- Data modules are tested end to end: real SQL plus the TypeScript mapping, with no mocked database.
- Each failure is logged once, naming the function.
- `getReservationsForEvent` still uses the Supabase table query builder. It isn't a database function, so moving it needs a new SQL function (a migration). It now throws `DbFailure` on an error too, but its tests wait for that move.
- An ID from a URL that isn't a UUID means "no such event or tier" (`isUuid`), not a failure, because the database rejects it with an error.
- Event and tier patch updates still read, then write, which isn't atomic (candidate #3).
