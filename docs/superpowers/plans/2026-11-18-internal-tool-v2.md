# Internal Tool V2 — Build Plan

> **For agentic workers:** Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Transform the prototype into a working internal counter tool. Staff select an event, fill in buyer details (including NIC), download a branded ticket card with QR, and hand it to the buyer. An admin portal lets the client manage events, ticket tiers, and view/void reservations. The whole app is behind a single shared password.

**Shared understanding source:** Grilling session 2026-11-18. Key decisions:
- Staff counter tool (not self-serve)
- QR delivered as downloaded PNG branded card
- Single `ADMIN_PASSWORD` env var, HMAC session cookie, whole app protected
- NIC / Passport No. required field, no format validation
- Upcoming published events only on counter homepage
- "Book next customer" button resets form but stays on same event
- Void = status change only, sold count unchanged
- Admin: events CRUD + tier CRUD + dashboard + reservations list with search + void
- Gate PIN auto-generated (6 uppercase hex chars), editable before save

**Architecture notes:**
- `next.config.ts` is already server-rendered (no `output: 'export'`)
- Middleware runs in Edge Runtime — uses cookie existence check only
- Full HMAC token verification happens in `src/lib/auth.ts` (Node.js), called via `requireAuth()` in server components
- Existing routes (`/reserve`, `/gate`, APIs) stay in place; `requireAuth()` added to their pages
- Admin routes live under `src/app/admin/`

---

## File Map

| Action | Path |
|--------|------|
| Modify | `.env.example` |
| Create | `src/middleware.ts` |
| Create | `src/lib/auth.ts` |
| Create | `src/app/login/page.tsx` |
| Create | `src/app/api/auth/login/route.ts` |
| Create | `src/app/api/auth/logout/route.ts` |
| Create | `supabase/migrations/0004_add_nic_and_update_rpc.sql` |
| Modify | `src/types/database.ts` |
| Modify | `src/lib/utils/validate-reservation.ts` |
| Modify | `src/lib/utils/validate-reservation.test.ts` |
| Modify | `src/lib/data/reservations.ts` |
| Modify | `src/app/api/reserve/route.ts` |
| Modify | `src/lib/data/events.ts` |
| Modify | `src/app/page.tsx` |
| Modify | `src/app/reserve/[eventId]/page.tsx` |
| Modify | `src/app/gate/[eventId]/page.tsx` |
| Modify | `src/components/reservation/ReservationForm.tsx` |
| Create | `src/lib/utils/generate-pin.ts` |
| Create | `src/lib/data/admin/events.ts` |
| Create | `src/lib/data/admin/tiers.ts` |
| Create | `src/lib/data/admin/reservations.ts` |
| Create | `src/app/admin/layout.tsx` |
| Create | `src/app/admin/page.tsx` |
| Create | `src/app/admin/events/page.tsx` |
| Create | `src/app/admin/events/new/page.tsx` |
| Create | `src/app/admin/events/[id]/page.tsx` |
| Create | `src/app/admin/events/[id]/edit/page.tsx` |
| Create | `src/app/admin/events/[id]/tiers/page.tsx` |
| Create | `src/app/admin/events/[id]/reservations/page.tsx` |
| Create | `src/app/api/admin/events/route.ts` |
| Create | `src/app/api/admin/events/[id]/route.ts` |
| Create | `src/app/api/admin/events/[id]/tiers/route.ts` |
| Create | `src/app/api/admin/events/[id]/tiers/[tierId]/route.ts` |
| Create | `src/app/api/admin/reservations/[id]/void/route.ts` |

---

## Task 0.1 — Auth foundation

**Files:** `.env.example`, `src/lib/auth.ts`, `src/middleware.ts`

- [ ] **Step 1: Update `.env.example`**

Add `SESSION_SECRET` and replace `ADMIN_PASSWORD_HASH` with `ADMIN_PASSWORD`:

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Admin auth
ADMIN_PASSWORD=choose-a-strong-password
SESSION_SECRET=generate-with-openssl-rand-hex-32

# App URL (no trailing slash)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Also add both vars to `.env.local` with real values.

- [ ] **Step 2: Create `src/lib/auth.ts`**

```typescript
import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const SESSION_COOKIE = 'snt_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function createSessionToken(): string {
  const timestamp = Date.now().toString()
  const mac = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(timestamp)
    .digest('hex')
  return `${timestamp}.${mac}`
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [timestamp, mac] = parts
  const age = Date.now() - parseInt(timestamp, 10)
  if (isNaN(age) || age > SESSION_DURATION_MS) return false
  const expected = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(timestamp)
    .digest('hex')
  return mac === expected
}

export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token || !verifySessionToken(token)) {
    redirect('/login')
  }
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // seconds
```

- [ ] **Step 3: Create `src/middleware.ts`**

Middleware runs in Edge Runtime — it only checks cookie *existence* for a fast redirect. Full token verification happens server-side in `requireAuth()`.

```typescript
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const session = request.cookies.get('snt_session')?.value
  if (!session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add .env.example src/lib/auth.ts src/middleware.ts
git commit -m "feat: add auth foundation — HMAC session, edge middleware"
```

---

## Task 0.2 — Login and logout pages

**Files:** `src/app/login/page.tsx`, `src/app/api/auth/login/route.ts`, `src/app/api/auth/logout/route.ts`

- [ ] **Step 1: Create `src/app/api/auth/login/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (body.password !== process.env.ADMIN_PASSWORD) {
    // Constant-time-ish delay to slow brute force
    await new Promise(r => setTimeout(r, 300))
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const token = createSessionToken()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return response
}
```

- [ ] **Step 2: Create `src/app/api/auth/logout/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

export async function POST() {
  const response = NextResponse.redirect(
    new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
  )
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
```

- [ ] **Step 3: Create `src/app/login/page.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from') ?? '/'
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (!res.ok) {
      setError('Incorrect password')
      setLoading(false)
      return
    }

    router.push(from)
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-void flex items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <div className="mb-10">
          <p className="text-lime-spark font-semibold uppercase mb-4"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
            SNT Entertainment
          </p>
          <h1 className="text-bone-white font-normal"
            style={{ fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            Staff access
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <label className="block text-ash-gray font-semibold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 mb-8 outline-none focus:border-electric-iris transition-colors"
            style={{ fontSize: '18px' }}
          />

          {error && (
            <p className="text-saffron-spark mb-6" style={{ fontSize: '14px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase disabled:opacity-40 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
            style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', padding: '14px 32px' }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
```

- [ ] **Step 4: Build and smoke-test**

```bash
npm run build
```

Navigate to `http://localhost:3000` — should redirect to `/login`. Enter wrong password — should show error. Enter correct password — should redirect to `/`.

- [ ] **Step 5: Commit**

```bash
git add src/app/login/page.tsx src/app/api/auth/login/route.ts src/app/api/auth/logout/route.ts
git commit -m "feat: add login/logout — password gate on entire app"
```

---

## Task 0.3 — Protect existing pages

Add `requireAuth()` to the three existing server pages so an expired/invalid cookie is caught even after the middleware passes.

**Files:** `src/app/page.tsx`, `src/app/reserve/[eventId]/page.tsx`, `src/app/gate/[eventId]/page.tsx`

- [ ] **Step 1: Add `requireAuth()` to `src/app/page.tsx`**

At the top of the default export function, before any other logic:

```typescript
import { requireAuth } from '@/lib/auth'
// ...
export default async function HomePage() {
  await requireAuth()
  // existing JSX
}
```

- [ ] **Step 2: Add `requireAuth()` to `src/app/reserve/[eventId]/page.tsx`**

```typescript
import { requireAuth } from '@/lib/auth'
// ...
export default async function ReservePage({ params }: Props) {
  await requireAuth()
  // rest of function unchanged
}
```

- [ ] **Step 3: Add `requireAuth()` to `src/app/gate/[eventId]/page.tsx`**

Same pattern.

- [ ] **Step 4: Build**

```bash
npm run build && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx "src/app/reserve/[eventId]/page.tsx" "src/app/gate/[eventId]/page.tsx"
git commit -m "feat: protect existing pages with requireAuth()"
```

---

## Task 1.1 — NIC database migration

**Files:** `supabase/migrations/0004_add_nic_and_update_rpc.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add NIC column
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nic text;

-- Recreate create_reservation to accept nic
-- Must DROP first because adding a parameter changes the signature
DROP FUNCTION IF EXISTS create_reservation(text, uuid, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION create_reservation(
  p_id          text,
  p_event_id    uuid,
  p_buyer_name  text,
  p_buyer_email text,
  p_buyer_phone text,
  p_buyer_nic   text,
  p_items       jsonb
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item       jsonb;
  v_type_id    uuid;
  v_quantity   int;
  v_capacity   int;
  v_sold       int;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_type_id  := (v_item->>'ticket_type_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    SELECT capacity, sold
      INTO v_capacity, v_sold
      FROM ticket_types
     WHERE id = v_type_id
       AND event_id = p_event_id
       FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'ticket_type_not_found:%', v_type_id;
    END IF;

    IF v_sold + v_quantity > v_capacity THEN
      RAISE EXCEPTION 'capacity_exceeded:%', v_type_id;
    END IF;
  END LOOP;

  INSERT INTO reservations (id, event_id, buyer_name, buyer_email, buyer_phone, nic, status)
  VALUES (p_id, p_event_id, p_buyer_name, p_buyer_email, p_buyer_phone, p_buyer_nic, 'active');

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_type_id  := (v_item->>'ticket_type_id')::uuid;
    v_quantity := (v_item->>'quantity')::int;

    INSERT INTO reservation_items (reservation_id, ticket_type_id, quantity)
    VALUES (p_id, v_type_id, v_quantity);

    UPDATE ticket_types
       SET sold = sold + v_quantity
     WHERE id = v_type_id;
  END LOOP;

  RETURN p_id;
END;
$$;
```

- [ ] **Step 2: Apply to local Supabase**

```bash
supabase db reset
```

Or apply manually if you don't want to reseed:

```bash
supabase db push
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_add_nic_and_update_rpc.sql
git commit -m "db: add nic column to reservations, update create_reservation RPC"
```

---

## Task 1.2 — NIC field in types, validation, data layer, API

**Files:** `src/types/database.ts`, `src/lib/utils/validate-reservation.ts`, `src/lib/utils/validate-reservation.test.ts`, `src/lib/data/reservations.ts`, `src/app/api/reserve/route.ts`

- [ ] **Step 1: Update `src/types/database.ts`**

Add `nic` to `Reservation` interface and update the `create_reservation` function args:

```typescript
export interface Reservation {
  id: string
  event_id: string
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  nic: string | null
  status: ReservationStatus
  created_at: string
}
```

In the `Database` type, update `Functions.create_reservation.Args`:

```typescript
create_reservation: {
  Args: {
    p_id: string
    p_event_id: string
    p_buyer_name: string
    p_buyer_email: string
    p_buyer_phone: string
    p_buyer_nic: string
    p_items: { ticket_type_id: string; quantity: number }[]
  }
  Returns: string
}
```

Also update `reservations` Insert to include nic:

```typescript
reservations: {
  Row: Reservation
  Insert: Omit<Reservation, 'created_at'> & { created_at?: string }
  Update: Partial<Omit<Reservation, 'id'>>
  Relationships: []
}
```

- [ ] **Step 2: Update `src/lib/utils/validate-reservation.ts`**

Add `buyer_nic` to `ReservationInput` and validate it:

```typescript
export interface ReservationInput {
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  buyer_nic: string
  items: ReservationInputItem[]
  consent: boolean
}
```

Inside `validateReservationInput`, add after the phone check:

```typescript
if (typeof r.buyer_nic !== 'string' || !r.buyer_nic.trim()) {
  return { valid: false, error: 'NIC / Passport No. is required' }
}
```

Add `buyer_nic` to the returned data object:

```typescript
return {
  valid: true,
  data: {
    buyer_name: (r.buyer_name as string).trim(),
    buyer_email: (r.buyer_email as string).trim().toLowerCase(),
    buyer_phone: (r.buyer_phone as string).trim(),
    buyer_nic: (r.buyer_nic as string).trim(),
    items: r.items as ReservationInputItem[],
    consent: true,
  },
}
```

- [ ] **Step 3: Update `src/lib/utils/validate-reservation.test.ts`**

Add `buyer_nic: '200012345678'` to the `valid` fixture. Add two new tests:

```typescript
it('rejects missing nic', () => {
  const result = validateReservationInput({ ...valid, buyer_nic: '' }, 10)
  expect(result.valid).toBe(false)
  if (!result.valid) expect(result.error).toMatch(/NIC/i)
})

it('trims buyer_nic', () => {
  const result = validateReservationInput({ ...valid, buyer_nic: '  200012345678  ' }, 10)
  expect(result.valid).toBe(true)
  if (result.valid) expect(result.data.buyer_nic).toBe('200012345678')
})
```

Also update the "trims buyer_name" test fixture to include `buyer_nic`.

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Update `src/lib/data/reservations.ts`**

Add `buyer_nic` parameter and pass it to the RPC:

```typescript
export async function createReservation(
  eventId: string,
  input: ReservationInput
): Promise<ReservationResult> {
  const supabase = await createClient()
  const reservationId = generateReservationId()

  type RpcResult = { data: string | null; error: { message: string } | null }
  const { data, error } = await (supabase.rpc as unknown as (fn: string, args: Record<string, unknown>) => PromiseLike<RpcResult>)(
    'create_reservation',
    {
      p_id: reservationId,
      p_event_id: eventId,
      p_buyer_name: input.buyer_name,
      p_buyer_email: input.buyer_email,
      p_buyer_phone: input.buyer_phone,
      p_buyer_nic: input.buyer_nic,
      p_items: input.items,
    }
  )

  if (error) {
    if (error.message.includes('capacity_exceeded')) return { ok: false, error: 'capacity_exceeded' }
    if (error.message.includes('ticket_type_not_found')) return { ok: false, error: 'ticket_type_not_found' }
    return { ok: false, error: 'unknown' }
  }

  return { ok: true, reservationId: data as string }
}
```

- [ ] **Step 6: Update `src/app/api/reserve/route.ts`**

Remove the hardcoded `MAX_PER_RESERVATION = 10`. Fetch the event to get `max_per_reservation` and pass it to validation:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateReservationInput } from '@/lib/utils/validate-reservation'
import { createReservation } from '@/lib/data/reservations'

export async function POST(request: NextRequest) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const eventId = request.nextUrl.searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('max_per_reservation, status')
    .eq('id', eventId)
    .single()

  if (eventError || !event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (event.status !== 'published') {
    return NextResponse.json({ error: 'Event is not accepting reservations' }, { status: 400 })
  }

  const validation = validateReservationInput(body, event.max_per_reservation)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }

  const result = await createReservation(eventId, validation.data)

  if (!result.ok) {
    const status = result.error === 'capacity_exceeded' ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ reservationId: result.reservationId }, { status: 201 })
}
```

- [ ] **Step 7: Build and test**

```bash
npm test && npm run build
```

- [ ] **Step 8: Commit**

```bash
git add src/types/database.ts src/lib/utils/validate-reservation.ts src/lib/utils/validate-reservation.test.ts src/lib/data/reservations.ts src/app/api/reserve/route.ts
git commit -m "feat: add NIC field to reservation flow, fix hardcoded max_per_reservation"
```

---

## Task 1.3 — Homepage event selector

**Files:** `src/lib/data/events.ts` (add function), `src/app/page.tsx`

- [ ] **Step 1: Add `getUpcomingEvents` to `src/lib/data/events.ts`**

Append to the existing file:

```typescript
export async function getUpcomingEvents(): Promise<Event[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('status', 'published')
    .gte('date_time', new Date().toISOString())
    .order('date_time', { ascending: true })
  if (error || !data) return []
  return data
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
import { getUpcomingEvents } from '@/lib/data/events'
import type { Event } from '@/types/database'

function EventCard({ event }: { event: Event }) {
  const date = new Date(event.date_time)
  const dateStr = date.toLocaleDateString('en-LK', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'Asia/Colombo',
  })
  const timeStr = date.toLocaleTimeString('en-LK', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Colombo',
  })

  return (
    <Link
      href={`/reserve/${event.id}`}
      className="block p-6 border border-[#1a1a1a] hover:border-[#333] active:scale-[0.99] transition-[border-color,transform] duration-150 ease-out animate-fade-in-up"
      style={{ borderRadius: '16px' }}
    >
      <p className="text-lime-spark font-semibold uppercase mb-3"
        style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
        {dateStr} · {timeStr}
      </p>
      <h2 className="text-bone-white font-normal mb-1"
        style={{ fontSize: '22px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
        {event.name}
      </h2>
      <p className="text-ash-gray font-light"
        style={{ fontSize: '14px' }}>
        {event.venue}
      </p>
    </Link>
  )
}

export default async function HomePage() {
  await requireAuth()
  const events = await getUpcomingEvents()

  return (
    <main className="min-h-screen bg-void px-6 py-16">
      <div className="max-w-[640px] mx-auto">

        <div className="flex items-center justify-between mb-14">
          <div>
            <p className="text-ash-gray font-semibold uppercase"
              style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
              SNT Entertainment
            </p>
            <h1 className="text-bone-white font-normal mt-1"
              style={{ fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Select event
            </h1>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-ash-gray font-light hover:text-bone-white transition-colors"
              style={{ fontSize: '13px' }}
            >
              Sign out
            </button>
          </form>
        </div>

        {events.length === 0 ? (
          <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>
            No upcoming events. Create one in the{' '}
            <Link href="/admin/events" className="text-electric-iris hover:underline">
              admin portal
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-[#1a1a1a]">
          <Link
            href="/admin"
            className="text-ash-gray font-light hover:text-bone-white transition-colors"
            style={{ fontSize: '13px' }}
          >
            Admin portal →
          </Link>
        </div>

      </div>
    </main>
  )
}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/events.ts src/app/page.tsx
git commit -m "feat: homepage event selector for counter staff"
```

---

## Task 1.4 — NIC field + QR download + "Book next customer"

**Files:** `src/components/reservation/ReservationForm.tsx`

This task has three additions to the existing form:
1. NIC / Passport No. input field (after phone, before consent)
2. Canvas-based branded ticket card download on the success screen
3. "Book next customer" button that resets the form state

- [ ] **Step 1: Rewrite `src/components/reservation/ReservationForm.tsx`**

Key changes from current version:
- Add `buyerNic` state and `nic` field errors
- Add NIC `LineInput` after phone
- Pass `buyer_nic` in the POST body
- Success screen: add `downloadTicketCard()` function and download button, plus "Book next customer" button
- Store `submittedItems` on success so the ticket summary is available for the card

```tsx
'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'
import type { Event, TicketType } from '@/types/database'
import { TicketTypeRow } from './TicketTypeRow'

interface Props {
  event: Event
  ticketTypes: TicketType[]
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

interface FieldErrors {
  buyer_name?: string
  buyer_email?: string
  buyer_phone?: string
  buyer_nic?: string
  items?: string
  consent?: string
}

interface SubmittedItem {
  name: string
  quantity: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-ash-gray font-semibold uppercase mb-6"
      style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
      {children}
    </p>
  )
}

function LineInput({
  id, label, type = 'text', autoComplete, value, onChange, error, placeholder,
}: {
  id: string; label: string; type?: string; autoComplete?: string
  value: string; onChange: (v: string) => void; error?: string; placeholder?: string
}) {
  return (
    <div className="mb-8">
      <label htmlFor={id} className="block text-ash-gray font-semibold uppercase mb-3"
        style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
        {label}
      </label>
      <input
        id={id} type={type} autoComplete={autoComplete} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]"
        style={{ fontSize: '18px' }}
      />
      {error && <p className="text-saffron-spark mt-2" style={{ fontSize: '12px' }}>{error}</p>}
    </div>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

async function downloadTicketCard(params: {
  reservationId: string
  eventName: string
  venue: string
  dateStr: string
  items: SubmittedItem[]
}) {
  const { reservationId, eventName, venue, dateStr, items } = params
  const W = 600, H = 820

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  // Lime accent bar
  ctx.fillStyle = '#b9ff4b'
  ctx.fillRect(40, 44, 48, 3)

  // "SNT ENTERTAINMENT" label
  ctx.fillStyle = '#9a9a9a'
  ctx.font = '600 11px system-ui, -apple-system, sans-serif'
  ctx.fillText('SNT ENTERTAINMENT', 40, 84)

  // Event name (truncate if too long)
  ctx.fillStyle = '#ffffff'
  ctx.font = '400 30px system-ui, -apple-system, sans-serif'
  const truncatedName = eventName.length > 32 ? eventName.slice(0, 32) + '…' : eventName
  ctx.fillText(truncatedName, 40, 134)

  // Date + venue
  ctx.fillStyle = '#9a9a9a'
  ctx.font = '300 15px system-ui, -apple-system, sans-serif'
  ctx.fillText(dateStr, 40, 166)
  ctx.fillText(venue, 40, 190)

  // White QR card
  const qrPad = 24
  const qrCardX = 100, qrCardY = 220, qrCardSize = 400
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 20)
  ctx.fill()

  // Draw QR SVG onto canvas
  const svgEl = document.getElementById('ticket-qr-svg') as SVGElement | null
  if (svgEl) {
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, qrCardX + qrPad, qrCardY + qrPad, qrCardSize - qrPad * 2, qrCardSize - qrPad * 2)
        resolve()
      }
      img.onerror = () => resolve()
      img.src = svgDataUrl
    })
  }

  // Reservation ID
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 18px system-ui, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(reservationId, W / 2, 668)

  // Ticket summary
  ctx.fillStyle = '#9a9a9a'
  ctx.font = '300 14px system-ui, -apple-system, sans-serif'
  const summaryParts = items.map(i => `${i.quantity}× ${i.name}`)
  ctx.fillText(summaryParts.join('  ·  '), W / 2, 696, 520)

  // Divider
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, 724)
  ctx.lineTo(W - 40, 724)
  ctx.stroke()

  // "SHOW THIS AT THE GATE"
  ctx.fillStyle = '#b9ff4b'
  ctx.font = '600 11px system-ui, -apple-system, sans-serif'
  ctx.fillText('SHOW THIS AT THE GATE', W / 2, 760)

  ctx.textAlign = 'left'

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reservationId}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

export function ReservationForm({ event, ticketTypes }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerNic, setBuyerNic] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [serverError, setServerError] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [submittedItems, setSubmittedItems] = useState<SubmittedItem[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const totalTickets = Object.values(quantities).reduce((sum, q) => sum + q, 0)

  function handleQuantityChange(typeId: string, qty: number) {
    setQuantities(prev => ({ ...prev, [typeId]: qty }))
    setFieldErrors(prev => ({ ...prev, items: undefined }))
  }

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!buyerName.trim()) errors.buyer_name = 'Name is required'
    if (!buyerEmail.includes('@')) errors.buyer_email = 'Valid email is required'
    if (!buyerPhone.trim()) errors.buyer_phone = 'Phone is required'
    if (!buyerNic.trim()) errors.buyer_nic = 'NIC / Passport No. is required'
    if (totalTickets === 0) errors.items = 'Select at least one ticket'
    if (!consent) errors.consent = 'You must accept to continue'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return
    setStatus('submitting')
    setServerError('')

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }))

    try {
      const res = await fetch(`/api/reserve?eventId=${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: buyerName, buyer_email: buyerEmail,
          buyer_phone: buyerPhone, buyer_nic: buyerNic,
          items, consent,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setStatus('error')
        setServerError(
          json.error === 'capacity_exceeded'
            ? 'Some tickets sold out while booking. Please adjust your selection.'
            : json.error ?? 'Something went wrong.'
        )
        return
      }

      // Build submitted items for ticket card
      const submitted: SubmittedItem[] = items.map(item => {
        const tt = ticketTypes.find(t => t.id === item.ticket_type_id)
        return { name: tt?.name ?? 'Ticket', quantity: item.quantity }
      })

      setReservationId(json.reservationId)
      setSubmittedItems(submitted)
      setStatus('success')
    } catch {
      setStatus('error')
      setServerError('Network error. Please check your connection.')
    }
  }

  function resetForm() {
    setQuantities({})
    setBuyerName('')
    setBuyerEmail('')
    setBuyerPhone('')
    setBuyerNic('')
    setConsent(false)
    setStatus('idle')
    setServerError('')
    setReservationId('')
    setSubmittedItems([])
    setFieldErrors({})
  }

  if (status === 'success') {
    const eventDate = new Date(event.date_time)
    const dateStr = eventDate.toLocaleDateString('en-LK', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'Asia/Colombo',
    })

    return (
      <div className="py-10 animate-fade-in-up">
        <p className="text-lime-spark font-semibold uppercase mb-6"
          style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
          Confirmed
        </p>
        <h2 className="text-bone-white font-normal mb-6"
          style={{ fontSize: '36px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Reservation created.
        </h2>
        <p className="text-ash-gray font-light mb-8" style={{ fontSize: '17px' }}>
          Download the ticket card and hand or send it to the buyer.
        </p>

        {/* Hidden QR for canvas capture */}
        <div className="inline-block p-5 mb-6 animate-scale-in"
          style={{ background: '#ffffff', borderRadius: '16px' }}>
          <QRCode id="ticket-qr-svg" value={reservationId} size={200}
            bgColor="#ffffff" fgColor="#000000" />
        </div>

        <p className="text-ash-gray font-semibold uppercase tracking-widest mb-10"
          style={{ fontSize: '13px', letterSpacing: '0.2em' }}>
          {reservationId}
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => downloadTicketCard({
              reservationId,
              eventName: event.name,
              venue: event.venue,
              dateStr,
              items: submittedItems,
            })}
            className="inline-flex items-center justify-center gap-2 bg-electric-iris text-bone-white font-semibold uppercase hover:opacity-90 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
            style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', padding: '14px 32px' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download ticket card
          </button>

          <button
            onClick={resetForm}
            className="inline-flex items-center justify-center text-ash-gray font-light hover:text-bone-white transition-colors active:scale-[0.97] duration-100 ease-out"
            style={{ fontSize: '14px', padding: '14px 32px' }}
          >
            Book next customer
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* Ticket selection */}
      <section className="mb-14">
        <SectionLabel>Select tickets</SectionLabel>
        <div>
          {ticketTypes.map(tt => (
            <TicketTypeRow
              key={tt.id} ticketType={tt}
              quantity={quantities[tt.id] ?? 0}
              onChange={handleQuantityChange}
              max={event.max_per_reservation}
            />
          ))}
        </div>
        {fieldErrors.items && (
          <p className="text-saffron-spark mt-4" style={{ fontSize: '12px' }}>
            {fieldErrors.items}
          </p>
        )}
        <p className="text-ash-gray font-light mt-4" style={{ fontSize: '14px' }}>
          Maximum {event.max_per_reservation} tickets per reservation.
          {totalTickets > 0 && (
            <span className="text-lime-spark ml-2 font-semibold">{totalTickets} selected.</span>
          )}
        </p>
      </section>

      {/* Buyer details */}
      <section className="mb-10">
        <SectionLabel>Buyer details</SectionLabel>
        <LineInput id="buyer_name" label="Full name" autoComplete="name"
          value={buyerName} onChange={v => { setBuyerName(v); setFieldErrors(p => ({ ...p, buyer_name: undefined })) }}
          error={fieldErrors.buyer_name} placeholder="Full name" />
        <LineInput id="buyer_email" label="Email" type="email" autoComplete="email"
          value={buyerEmail} onChange={v => { setBuyerEmail(v); setFieldErrors(p => ({ ...p, buyer_email: undefined })) }}
          error={fieldErrors.buyer_email} placeholder="email@example.com" />
        <LineInput id="buyer_phone" label="Phone" type="tel" autoComplete="tel"
          value={buyerPhone} onChange={v => { setBuyerPhone(v); setFieldErrors(p => ({ ...p, buyer_phone: undefined })) }}
          error={fieldErrors.buyer_phone} placeholder="+94 77 000 0000" />
        <LineInput id="buyer_nic" label="NIC / Passport No."
          value={buyerNic} onChange={v => { setBuyerNic(v); setFieldErrors(p => ({ ...p, buyer_nic: undefined })) }}
          error={fieldErrors.buyer_nic} placeholder="200012345678 or A12345678" />
      </section>

      {/* Consent */}
      <div className="flex gap-4 mb-12">
        <button type="button" role="checkbox" aria-checked={consent}
          onClick={() => { setConsent(c => !c); setFieldErrors(p => ({ ...p, consent: undefined })) }}
          className="mt-1 w-5 h-5 rounded border shrink-0 flex items-center justify-center active:scale-90 transition-[transform,background-color,border-color] duration-100 ease-out"
          style={{ borderColor: consent ? '#8052ff' : '#333', backgroundColor: consent ? '#8052ff' : 'transparent' }}>
          {consent && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <label className="text-ash-gray font-light cursor-pointer" style={{ fontSize: '15px', lineHeight: 1.5 }}
          onClick={() => { setConsent(c => !c); setFieldErrors(p => ({ ...p, consent: undefined })) }}>
          Buyer consents to their details being used to process this reservation.
        </label>
      </div>
      {fieldErrors.consent && (
        <p className="text-saffron-spark -mt-8 mb-10" style={{ fontSize: '12px' }}>{fieldErrors.consent}</p>
      )}

      {status === 'error' && serverError && (
        <p className="text-saffron-spark mb-8" style={{ fontSize: '15px' }}>{serverError}</p>
      )}

      <button type="submit" disabled={status === 'submitting'}
        className="inline-flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase disabled:opacity-40 hover:opacity-90 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
        style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', paddingTop: '14.4px', paddingBottom: '14.4px', paddingLeft: '32px', paddingRight: '32px', minWidth: '200px' }}>
        {status === 'submitting'
          ? 'Creating reservation…'
          : totalTickets > 0
            ? `Confirm ${totalTickets} ticket${totalTickets > 1 ? 's' : ''}`
            : 'Confirm reservation'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Build and lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 3: Smoke-test the full counter flow**

1. Sign in at `/login`
2. Homepage shows upcoming events
3. Select Neon Nights Vol. 3 → booking form
4. Add tickets, fill name/email/phone/NIC, check consent → submit
5. Success screen shows QR and two buttons
6. "Download ticket card" → PNG downloads with QR, event name, reservation ID
7. "Book next customer" → form resets, stays on same event

- [ ] **Step 4: Commit**

```bash
git add src/components/reservation/ReservationForm.tsx
git commit -m "feat: add NIC field, branded QR card download, book-next-customer flow"
```

---

## Task 2.1 — Admin shell

**Files:** `src/lib/utils/generate-pin.ts`, `src/app/admin/layout.tsx`, `src/app/admin/page.tsx`

- [ ] **Step 1: Create `src/lib/utils/generate-pin.ts`**

```typescript
import { randomBytes } from 'crypto'

export function generatePin(): string {
  return randomBytes(3).toString('hex').toUpperCase()
}
```

- [ ] **Step 2: Create `src/app/admin/layout.tsx`**

```tsx
import Link from 'next/link'
import { requireAuth } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAuth()

  return (
    <div className="min-h-screen bg-void">
      <nav className="border-b border-[#1a1a1a] px-6 py-4">
        <div className="max-w-[1024px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-ash-gray font-semibold uppercase"
              style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
              SNT · Admin
            </span>
            <Link href="/admin/events"
              className="text-ash-gray hover:text-bone-white transition-colors font-light"
              style={{ fontSize: '14px' }}>
              Events
            </Link>
          </div>
          <Link href="/"
            className="text-ash-gray hover:text-bone-white transition-colors font-light"
            style={{ fontSize: '13px' }}>
            ← Counter
          </Link>
        </div>
      </nav>
      <main className="max-w-[1024px] mx-auto px-6 py-12">
        {children}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/app/admin/page.tsx`**

```tsx
import { redirect } from 'next/navigation'
export default function AdminPage() {
  redirect('/admin/events')
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/utils/generate-pin.ts src/app/admin/layout.tsx src/app/admin/page.tsx
git commit -m "feat: admin shell — layout, nav, generate-pin utility"
```

---

## Task 2.2 — Admin data layer: events

**Files:** `src/lib/data/admin/events.ts`

- [ ] **Step 1: Create `src/lib/data/admin/events.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Event } from '@/types/database'

export type EventInsert = {
  name: string
  date_time: string
  venue: string
  description: string
  cover_image_url: string | null
  max_per_reservation: number
  gate_pin: string
  status: 'published' | 'draft'
}

export async function getAllEvents(): Promise<Event[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('date_time', { ascending: false })
  if (error || !data) return []
  return data
}

export async function getAdminEvent(id: string): Promise<Event | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events').select('*').eq('id', id).single()
  if (error || !data) return null
  return data
}

export async function createEvent(insert: EventInsert): Promise<{ id: string } | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('events').insert(insert).select('id').single()
  if (error || !data) return null
  return data
}

export async function updateEvent(id: string, patch: Partial<EventInsert>): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase.from('events').update(patch).eq('id', id)
  return !error
}

export async function closeEvent(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('events').update({ status: 'closed' }).eq('id', id)
  return !error
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/data/admin/events.ts
git commit -m "feat: admin events data layer"
```

---

## Task 2.3 — Admin events pages + API

**Files:** event list, new event form, edit event form, API routes

- [ ] **Step 1: Create `src/app/api/admin/events/route.ts`** — POST create event

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createEvent } from '@/lib/data/admin/events'

export async function POST(req: NextRequest) {
  const body = await req.json() as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const date_time = typeof body.date_time === 'string' ? body.date_time : ''
  const venue = typeof body.venue === 'string' ? body.venue.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const cover_image_url = typeof body.cover_image_url === 'string' && body.cover_image_url.trim()
    ? body.cover_image_url.trim() : null
  const max_per_reservation = typeof body.max_per_reservation === 'number'
    ? body.max_per_reservation : 6
  const gate_pin = typeof body.gate_pin === 'string' ? body.gate_pin.trim().toUpperCase() : ''
  const status = body.status === 'published' ? 'published' : 'draft' as const

  if (!name || !date_time || !venue || !gate_pin) {
    return NextResponse.json({ error: 'name, date_time, venue, gate_pin are required' }, { status: 422 })
  }

  const result = await createEvent({ name, date_time, venue, description, cover_image_url, max_per_reservation, gate_pin, status })
  if (!result) return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })

  return NextResponse.json({ id: result.id }, { status: 201 })
}
```

- [ ] **Step 2: Create `src/app/api/admin/events/[id]/route.ts`** — PATCH update + POST close

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { updateEvent, closeEvent } from '@/lib/data/admin/events'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const ok = await updateEvent(id, body)
  if (!ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json() as { action?: string }
  if (body.action === 'close') {
    const ok = await closeEvent(id)
    if (!ok) return NextResponse.json({ error: 'Failed to close event' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
```

- [ ] **Step 3: Create `src/app/admin/events/page.tsx`** — events list

Server component. Fetches all events and renders a table with name, date, status, sold/capacity link, and "Edit" / "Close" actions.

```tsx
import Link from 'next/link'
import { getAllEvents } from '@/lib/data/admin/events'

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    published: 'color:#b9ff4b',
    draft: 'color:#9a9a9a',
    closed: 'color:#ffb829',
    archived: 'color:#333',
  }
  return (
    <span className="font-semibold uppercase" style={{ fontSize: '11px', letterSpacing: '0.35px', ...(styles[status] ? { color: styles[status].split(':')[1] } : {}) }}>
      {status}
    </span>
  )
}

export default async function AdminEventsPage() {
  const events = await getAllEvents()

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-bone-white font-normal"
          style={{ fontSize: '28px', letterSpacing: '-0.02em' }}>
          Events
        </h1>
        <Link href="/admin/events/new"
          className="inline-flex items-center gap-2 bg-electric-iris text-bone-white font-semibold uppercase active:scale-[0.97] transition-transform duration-100 ease-out"
          style={{ fontSize: '13px', letterSpacing: '0.025em', borderRadius: '24px', padding: '10px 20px' }}>
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>No events yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(event => {
            const date = new Date(event.date_time).toLocaleDateString('en-LK', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              timeZone: 'Asia/Colombo',
            })
            return (
              <div key={event.id}
                className="flex items-center justify-between p-5 border border-[#1a1a1a]"
                style={{ borderRadius: '12px' }}>
                <div className="flex-1 min-w-0 mr-6">
                  <div className="flex items-center gap-3 mb-1">
                    {statusBadge(event.status)}
                    <span className="text-ash-gray font-light" style={{ fontSize: '12px' }}>
                      {date}
                    </span>
                  </div>
                  <p className="text-bone-white font-normal truncate" style={{ fontSize: '17px' }}>
                    {event.name}
                  </p>
                  <p className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
                    {event.venue}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <Link href={`/admin/events/${event.id}`}
                    className="text-ash-gray hover:text-bone-white transition-colors font-light"
                    style={{ fontSize: '13px' }}>
                    Dashboard
                  </Link>
                  <Link href={`/admin/events/${event.id}/edit`}
                    className="text-electric-iris hover:opacity-80 transition-opacity font-light"
                    style={{ fontSize: '13px' }}>
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Create `src/app/admin/events/new/page.tsx`** — new event form

Client component with fields: name, date_time (`datetime-local` input), venue, description, cover_image_url, max_per_reservation (number, default 6), gate_pin (pre-filled with `generatePin()` from a `useState` initializer, editable), status toggle (draft / published). On submit, `POST /api/admin/events`. On success, redirect to `/admin/events/[id]/tiers`.

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generatePin } from '@/lib/utils/generate-pin'

export default function NewEventPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [venue, setVenue] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [maxPer, setMaxPer] = useState(6)
  const [pin, setPin] = useState(() => generatePin())
  const [publish, setPublish] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/admin/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name, date_time: dateTime, venue, description,
        cover_image_url: coverUrl || null,
        max_per_reservation: maxPer,
        gate_pin: pin,
        status: publish ? 'published' : 'draft',
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error ?? 'Failed'); setSubmitting(false); return }
    router.push(`/admin/events/${json.id}/tiers`)
  }

  // Render a form with styled inputs matching the SNT design system.
  // Each field uses the same underline input pattern from ReservationForm.
  // Submit button disabled while submitting.
  // "Regenerate PIN" button next to the gate_pin field calls setPin(generatePin()).
  // ...
  // Full JSX omitted for brevity — implement following the LineInput pattern
  // from ReservationForm.tsx. Use <textarea> for description.
  return (
    <div>
      <h1 className="text-bone-white font-normal mb-10"
        style={{ fontSize: '28px', letterSpacing: '-0.02em' }}>
        New event
      </h1>
      <form onSubmit={handleSubmit} className="max-w-[560px]">
        {/* name, dateTime, venue, description, coverUrl, maxPer, pin, publish */}
        {/* Each field: label + underline input, same pattern as ReservationForm LineInput */}
        {/* Pin field has a small "Regenerate" button next to it */}
        {/* Publish toggle: a checkbox or button to set published vs draft */}
        {error && <p className="text-saffron-spark mb-6" style={{ fontSize: '14px' }}>{error}</p>}
        <button type="submit" disabled={submitting}
          className="inline-flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase disabled:opacity-40 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
          style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', padding: '14px 32px' }}>
          {submitting ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </div>
  )
}
```

> **Implementation note:** Fill in the full form fields following the `LineInput` pattern from `ReservationForm.tsx`. Use `type="datetime-local"` for the date field and `type="number" min={1} max={20}` for max_per_reservation.

- [ ] **Step 5: Create `src/app/admin/events/[id]/edit/page.tsx`** — edit event

Same form as `new/page.tsx` but pre-populated from `getAdminEvent(id)`. Submits `PATCH /api/admin/events/[id]`. Includes a "Close event" button that posts `{ action: 'close' }` to `POST /api/admin/events/[id]` and confirms with `window.confirm` before sending.

- [ ] **Step 6: Build**

```bash
npm run build && npm run lint
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/data/admin/events.ts src/app/api/admin/events src/app/admin/events
git commit -m "feat: admin events CRUD — list, create, edit, close"
```

---

## Task 2.4 — Admin ticket tiers

**Files:** `src/lib/data/admin/tiers.ts`, `src/app/api/admin/events/[id]/tiers/route.ts`, `src/app/api/admin/events/[id]/tiers/[tierId]/route.ts`, `src/app/admin/events/[id]/tiers/page.tsx`

- [ ] **Step 1: Create `src/lib/data/admin/tiers.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { TicketType } from '@/types/database'

export async function getTiersForEvent(eventId: string): Promise<TicketType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ticket_types').select('*').eq('event_id', eventId).order('sort_order')
  if (error || !data) return []
  return data
}

export async function createTier(eventId: string, data: {
  name: string; price: number; capacity: number; sort_order: number
}): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ticket_types').insert({ event_id: eventId, ...data, sold: 0 })
  return !error
}

export async function updateTier(id: string, patch: {
  name?: string; price?: number; capacity?: number
}): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  // Validate capacity >= sold before updating
  if (patch.capacity !== undefined) {
    const { data: current } = await supabase
      .from('ticket_types').select('sold').eq('id', id).single()
    if (current && patch.capacity < current.sold) {
      return { ok: false, error: `Capacity cannot be less than tickets already sold (${current.sold})` }
    }
  }

  const { error } = await supabase.from('ticket_types').update(patch).eq('id', id)
  if (error) return { ok: false, error: 'Update failed' }
  return { ok: true }
}

export async function deleteTier(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: tier } = await supabase
    .from('ticket_types').select('sold').eq('id', id).single()
  if (tier && tier.sold > 0) {
    return { ok: false, error: 'Cannot remove a tier with existing bookings' }
  }
  const { error } = await supabase.from('ticket_types').delete().eq('id', id)
  if (error) return { ok: false, error: 'Delete failed' }
  return { ok: true }
}
```

- [ ] **Step 2: Create API routes for tiers**

`src/app/api/admin/events/[id]/tiers/route.ts` — `POST` creates a tier.

`src/app/api/admin/events/[id]/tiers/[tierId]/route.ts` — `PATCH` updates, `DELETE` removes (checks sold > 0).

Both follow the same pattern as the events API routes — parse body, call data layer, return JSON.

- [ ] **Step 3: Create `src/app/admin/events/[id]/tiers/page.tsx`**

Server component that fetches tiers for the event and renders:
- Event name as heading
- Table of tiers: name, price (LKR), capacity, sold, remaining
- Each row has Edit (inline or modal) and Delete (disabled + tooltip if sold > 0)
- "Add tier" button opens an add form below the table (or inline)
- "← Back to event" link

The page is a server component; the add/edit/delete actions are client components that call the API routes and use `router.refresh()` to refetch.

- [ ] **Step 4: Build**

```bash
npm run build && npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/admin/tiers.ts src/app/api/admin/events src/app/admin/events
git commit -m "feat: admin ticket tiers CRUD per event"
```

---

## Task 3.1 — Event dashboard (capacity stats)

**Files:** `src/lib/data/admin/reservations.ts` (stats function), `src/app/admin/events/[id]/page.tsx`

- [ ] **Step 1: Add stats function to `src/lib/data/admin/reservations.ts`**

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Reservation } from '@/types/database'

export interface TierStat {
  id: string
  name: string
  price: number
  capacity: number
  sold: number
  remaining: number
}

export async function getEventStats(eventId: string): Promise<TierStat[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ticket_types')
    .select('id, name, price, capacity, sold')
    .eq('event_id', eventId)
    .order('sort_order')
  if (error || !data) return []
  return data.map(t => ({ ...t, remaining: t.capacity - t.sold }))
}

export async function getReservationsForEvent(
  eventId: string,
  search?: string
): Promise<(Reservation & { items: { ticket_type_name: string; quantity: number }[] })[]> {
  const supabase = await createClient()

  let query = supabase
    .from('reservations')
    .select(`
      *,
      reservation_items (
        quantity,
        ticket_types ( name )
      )
    `)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false })

  if (search) {
    const term = `%${search}%`
    query = query.or(`buyer_name.ilike.${term},nic.ilike.${term},id.ilike.${term}`)
  }

  const { data, error } = await query
  if (error || !data) return []

  return data.map((r: Record<string, unknown>) => {
    const items = ((r.reservation_items as { quantity: number; ticket_types: { name: string } }[]) ?? [])
      .map(i => ({ ticket_type_name: i.ticket_types.name, quantity: i.quantity }))
    return { ...(r as unknown as Reservation), items }
  })
}

export async function voidReservation(id: string): Promise<boolean> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('reservations').update({ status: 'void' }).eq('id', id)
  return !error
}
```

- [ ] **Step 2: Create `src/app/admin/events/[id]/page.tsx`** — dashboard

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminEvent } from '@/lib/data/admin/events'
import { getEventStats } from '@/lib/data/admin/reservations'

export default async function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [event, stats] = await Promise.all([getAdminEvent(id), getEventStats(id)])
  if (!event) notFound()

  const totalCapacity = stats.reduce((s, t) => s + t.capacity, 0)
  const totalSold = stats.reduce((s, t) => s + t.sold, 0)
  const totalRemaining = totalCapacity - totalSold
  const pct = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <p className="text-ash-gray font-semibold uppercase mb-2"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
            {event.status}
          </p>
          <h1 className="text-bone-white font-normal"
            style={{ fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
            {event.name}
          </h1>
          <p className="text-ash-gray font-light mt-1" style={{ fontSize: '14px' }}>
            {event.venue}
          </p>
        </div>
        <div className="flex gap-4 shrink-0">
          <Link href={`/admin/events/${id}/tiers`}
            className="text-ash-gray hover:text-bone-white transition-colors font-light"
            style={{ fontSize: '13px' }}>
            Tiers
          </Link>
          <Link href={`/admin/events/${id}/reservations`}
            className="text-electric-iris hover:opacity-80 transition-opacity font-light"
            style={{ fontSize: '13px' }}>
            Reservations
          </Link>
          <Link href={`/admin/events/${id}/edit`}
            className="text-ash-gray hover:text-bone-white transition-colors font-light"
            style={{ fontSize: '13px' }}>
            Edit
          </Link>
        </div>
      </div>

      {/* Total bar */}
      <div className="p-6 border border-[#1a1a1a] mb-6" style={{ borderRadius: '16px' }}>
        <div className="flex justify-between mb-4">
          <span className="text-ash-gray font-semibold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
            Total capacity
          </span>
          <span className="text-bone-white font-semibold" style={{ fontSize: '15px' }}>
            {totalSold} / {totalCapacity} sold · {pct}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, backgroundColor: pct >= 90 ? '#ffb829' : '#b9ff4b' }} />
        </div>
        <p className="text-ash-gray font-light mt-3" style={{ fontSize: '13px' }}>
          {totalRemaining} remaining
        </p>
      </div>

      {/* Per-tier breakdown */}
      <div className="flex flex-col gap-3">
        {stats.map(tier => {
          const tierPct = tier.capacity > 0 ? Math.round((tier.sold / tier.capacity) * 100) : 0
          return (
            <div key={tier.id} className="flex items-center justify-between p-5 border border-[#1a1a1a]"
              style={{ borderRadius: '12px' }}>
              <div>
                <p className="text-bone-white font-normal" style={{ fontSize: '16px' }}>
                  {tier.name}
                </p>
                <p className="text-saffron-spark font-semibold mt-0.5" style={{ fontSize: '13px' }}>
                  LKR {tier.price.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-bone-white font-semibold tabular-nums" style={{ fontSize: '16px' }}>
                  {tier.sold} / {tier.capacity}
                </p>
                <p className="text-ash-gray font-light mt-0.5" style={{ fontSize: '12px' }}>
                  {tier.remaining} left · {tierPct}%
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Build**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/admin/reservations.ts src/app/admin/events/[id]/page.tsx
git commit -m "feat: admin event dashboard — capacity stats per tier"
```

---

## Task 3.2 — Reservations list + void

**Files:** `src/app/api/admin/reservations/[id]/void/route.ts`, `src/app/admin/events/[id]/reservations/page.tsx`

- [ ] **Step 1: Create `src/app/api/admin/reservations/[id]/void/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { voidReservation } from '@/lib/data/admin/reservations'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const ok = await voidReservation(id)
  if (!ok) return NextResponse.json({ error: 'Failed to void reservation' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Create `src/app/admin/events/[id]/reservations/page.tsx`**

This is a server component that accepts `?q=` search param and renders a list. The void action is a client component button.

```tsx
import { notFound } from 'next/navigation'
import { getAdminEvent } from '@/lib/data/admin/events'
import { getReservationsForEvent } from '@/lib/data/admin/reservations'
import { ReservationRow } from '@/components/admin/ReservationRow'
import { SearchInput } from '@/components/admin/SearchInput'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function ReservationsPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q } = await searchParams

  const [event, reservations] = await Promise.all([
    getAdminEvent(id),
    getReservationsForEvent(id, q),
  ])
  if (!event) notFound()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-ash-gray font-light mb-1" style={{ fontSize: '13px' }}>
            {event.name}
          </p>
          <h1 className="text-bone-white font-normal"
            style={{ fontSize: '28px', letterSpacing: '-0.02em' }}>
            Reservations
          </h1>
        </div>
        <p className="text-ash-gray font-light" style={{ fontSize: '14px' }}>
          {reservations.length} result{reservations.length !== 1 ? 's' : ''}
        </p>
      </div>

      <SearchInput defaultValue={q} />

      <div className="mt-6 flex flex-col gap-2">
        {reservations.length === 0 ? (
          <p className="text-ash-gray font-light py-8" style={{ fontSize: '15px' }}>
            {q ? 'No results for that search.' : 'No reservations yet.'}
          </p>
        ) : (
          reservations.map(r => <ReservationRow key={r.id} reservation={r} />)
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `src/components/admin/SearchInput.tsx`**

Client component with a text input. On change (debounced 300ms), updates the `?q=` search param via `router.push`.

```tsx
'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue ?? '')

  useEffect(() => {
    const timer = setTimeout(() => {
      const url = value.trim()
        ? `${pathname}?q=${encodeURIComponent(value.trim())}`
        : pathname
      router.push(url)
    }, 300)
    return () => clearTimeout(timer)
  }, [value, pathname, router])

  return (
    <input
      type="search"
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder="Search by name, NIC, or reservation ID…"
      className="w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]"
      style={{ fontSize: '16px' }}
    />
  )
}
```

- [ ] **Step 4: Create `src/components/admin/ReservationRow.tsx`**

Client component that renders one reservation row with buyer details and a void button. The void button calls `POST /api/admin/reservations/[id]/void`, then `router.refresh()`.

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Reservation } from '@/types/database'

type Props = {
  reservation: Reservation & { items: { ticket_type_name: string; quantity: number }[] }
}

export function ReservationRow({ reservation: r }: Props) {
  const router = useRouter()
  const [voiding, setVoiding] = useState(false)
  const isVoid = r.status === 'void'

  async function handleVoid() {
    if (!confirm(`Void reservation ${r.id}? This cannot be undone.`)) return
    setVoiding(true)
    await fetch(`/api/admin/reservations/${r.id}/void`, { method: 'POST' })
    router.refresh()
  }

  const created = new Date(r.created_at).toLocaleString('en-LK', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Colombo',
  })

  return (
    <div
      className="p-5 border border-[#1a1a1a]"
      style={{ borderRadius: '12px', opacity: isVoid ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-bone-white font-semibold" style={{ fontSize: '15px' }}>
              {r.buyer_name}
            </span>
            {isVoid && (
              <span className="text-saffron-spark font-semibold uppercase"
                style={{ fontSize: '10px', letterSpacing: '0.35px' }}>
                Voided
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              {r.id}
            </span>
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              NIC: {r.nic ?? '—'}
            </span>
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              {r.buyer_phone}
            </span>
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              {r.buyer_email}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {r.items.map((item, i) => (
              <span key={i}
                className="text-saffron-spark font-semibold"
                style={{ fontSize: '12px' }}>
                {item.quantity}× {item.ticket_type_name}
              </span>
            ))}
          </div>
          <p className="text-[#444] font-light mt-2" style={{ fontSize: '12px' }}>
            {created}
          </p>
        </div>

        {!isVoid && (
          <button
            onClick={handleVoid}
            disabled={voiding}
            className="shrink-0 text-ash-gray hover:text-saffron-spark disabled:opacity-30 transition-colors font-light active:scale-95 duration-100 ease-out"
            style={{ fontSize: '12px' }}
          >
            {voiding ? 'Voiding…' : 'Void'}
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Build and lint**

```bash
npm run build && npm run lint
```

- [ ] **Step 6: End-to-end smoke test**

1. Sign in → homepage shows events
2. Book a reservation with NIC field → download ticket card PNG → "Book next customer" resets
3. Admin → Events → New event (auto-PIN) → create → add tiers
4. Admin → Event dashboard → see sold/remaining bars
5. Admin → Reservations → search by name → void → row shows "Voided"
6. Gate scanner at `/gate/[id]?pin=GATE01` → scan `RES-PREVIEW` → Admitted
7. `npm run build && npm run lint && npm test`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/admin/reservations src/app/admin/events src/components/admin
git commit -m "feat: admin reservations list — search, void action"
```

---

## Definition of done

- [ ] `npm run build` passes clean
- [ ] `npm run lint` passes clean
- [ ] `npm test` passes clean
- [ ] Whole app redirects to `/login` when no session cookie is present
- [ ] Counter flow: select event → book with NIC → download branded PNG card → "Book next customer" resets form
- [ ] Admin: create event with auto-PIN, add tiers, view dashboard, search/void reservations
- [ ] Gate scanner unchanged and functional
