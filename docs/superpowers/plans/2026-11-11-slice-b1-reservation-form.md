# Slice B1 — Reservation Form Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/reserve/[eventId]` page — an event-aware reservation form that checks capacity, writes to Supabase atomically, and redirects to `/ticket/[reservationId]` on success.

**Architecture:** The page is a Next.js App Router server component that fetches the event and ticket types from Supabase, filters out full types, and renders either a client-side reservation form or a sold-out state. Form submission hits a Next.js API route that calls a Postgres function (via Supabase RPC) to atomically check capacity, create the reservation, insert items, and increment sold counts in a single transaction — preventing double-booking under concurrent load. On success the client is redirected to `/ticket/[reservationId]` (built in B2).

**Tech Stack:** Next.js 16 App Router · TypeScript strict · Supabase Postgres + RPC · Tailwind CSS · Vitest

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `vitest.config.ts` | Vitest + tsconfig path alias |
| Create | `src/lib/utils/reservation-id.ts` | `generateReservationId()` → `RES-XXXXXX` |
| Create | `src/lib/utils/reservation-id.test.ts` | Unit tests |
| Create | `src/lib/utils/validate-reservation.ts` | Input validation — pure functions |
| Create | `src/lib/utils/validate-reservation.test.ts` | Unit tests |
| Create | `src/lib/data/events.ts` | `getEventWithTicketTypes(id)` |
| Create | `supabase/migrations/0002_reservation_rpc.sql` | `create_reservation()` Postgres function |
| Create | `src/lib/data/reservations.ts` | `createReservation()` — calls the RPC |
| Create | `src/app/api/reserve/route.ts` | `POST /api/reserve` handler |
| Create | `src/components/reservation/TicketTypeRow.tsx` | Quantity stepper for one ticket type |
| Create | `src/components/reservation/ReservationForm.tsx` | Full form: ticket selection + buyer fields |
| Create | `src/app/reserve/[eventId]/page.tsx` | Server page: fetch, gate, render |
| Create | `src/app/reserve/[eventId]/loading.tsx` | Loading skeleton |

---

## Task 1: Set up Vitest

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest and path plugin**

```bash
cd /Users/dilshan/Documents/TicketsSNT
npm install --save-dev vitest vite-tsconfig-paths
```

Expected: both packages appear in `devDependencies`.

- [ ] **Step 2: Create `vitest.config.ts`**

Create `vitest.config.ts` at the project root:

```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add test scripts to `package.json`**

In `package.json`, update the `scripts` section to add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Result should look like:

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 4: Verify vitest runs (no test files yet)**

```bash
npm test
```

Expected: `No test files found` or `0 tests passed` — not an error exit.

- [ ] **Step 5: Commit**

```bash
git add vitest.config.ts package.json package-lock.json
git commit -m "test: add Vitest with tsconfig path alias"
```

---

## Task 2: Reservation ID utility

**Files:**
- Create: `src/lib/utils/reservation-id.ts`
- Create: `src/lib/utils/reservation-id.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/utils/reservation-id.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { generateReservationId } from './reservation-id'

describe('generateReservationId', () => {
  it('has the RES- prefix', () => {
    expect(generateReservationId()).toMatch(/^RES-/)
  })

  it('has exactly 6 uppercase hex characters after the prefix', () => {
    expect(generateReservationId()).toMatch(/^RES-[0-9A-F]{6}$/)
  })

  it('generates unique IDs across 100 calls', () => {
    const ids = new Set(Array.from({ length: 100 }, generateReservationId))
    expect(ids.size).toBe(100)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: 3 failures — `generateReservationId` is not defined yet.

- [ ] **Step 3: Implement**

Create `src/lib/utils/reservation-id.ts`:

```typescript
import { randomBytes } from 'crypto'

export function generateReservationId(): string {
  return 'RES-' + randomBytes(3).toString('hex').toUpperCase()
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/reservation-id.ts src/lib/utils/reservation-id.test.ts
git commit -m "feat: add reservation ID generator (RES-XXXXXX)"
```

---

## Task 3: Input validation utilities

**Files:**
- Create: `src/lib/utils/validate-reservation.ts`
- Create: `src/lib/utils/validate-reservation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/utils/validate-reservation.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { validateReservationInput } from './validate-reservation'

const valid = {
  buyer_name: 'Alice Perera',
  buyer_email: 'alice@example.com',
  buyer_phone: '0771234567',
  items: [{ ticket_type_id: 'type-abc', quantity: 2 }],
  consent: true,
}

describe('validateReservationInput', () => {
  it('accepts valid input', () => {
    const result = validateReservationInput(valid, 10)
    expect(result.valid).toBe(true)
  })

  it('rejects missing name', () => {
    const result = validateReservationInput({ ...valid, buyer_name: '' }, 10)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/name/i)
  })

  it('rejects name that is only whitespace', () => {
    const result = validateReservationInput({ ...valid, buyer_name: '   ' }, 10)
    expect(result.valid).toBe(false)
  })

  it('rejects email without @', () => {
    const result = validateReservationInput({ ...valid, buyer_email: 'notanemail' }, 10)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/email/i)
  })

  it('rejects missing phone', () => {
    const result = validateReservationInput({ ...valid, buyer_phone: '' }, 10)
    expect(result.valid).toBe(false)
  })

  it('rejects empty items array', () => {
    const result = validateReservationInput({ ...valid, items: [] }, 10)
    expect(result.valid).toBe(false)
  })

  it('rejects item with quantity 0', () => {
    const result = validateReservationInput(
      { ...valid, items: [{ ticket_type_id: 'x', quantity: 0 }] },
      10
    )
    expect(result.valid).toBe(false)
  })

  it('rejects total exceeding max_per_reservation', () => {
    const result = validateReservationInput(
      { ...valid, items: [{ ticket_type_id: 'x', quantity: 5 }] },
      4
    )
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatch(/maximum/i)
  })

  it('rejects missing consent', () => {
    const result = validateReservationInput({ ...valid, consent: false }, 10)
    expect(result.valid).toBe(false)
  })

  it('trims buyer_name and lowercases buyer_email', () => {
    const result = validateReservationInput(
      { ...valid, buyer_name: '  Alice  ', buyer_email: '  ALICE@EXAMPLE.COM  ' },
      10
    )
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.buyer_name).toBe('Alice')
      expect(result.data.buyer_email).toBe('alice@example.com')
    }
  })

  it('rejects non-object body', () => {
    const result = validateReservationInput(null, 10)
    expect(result.valid).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npm test
```

Expected: 11 failures.

- [ ] **Step 3: Implement**

Create `src/lib/utils/validate-reservation.ts`:

```typescript
export interface ReservationInputItem {
  ticket_type_id: string
  quantity: number
}

export interface ReservationInput {
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  items: ReservationInputItem[]
  consent: boolean
}

export type ValidationResult =
  | { valid: true; data: ReservationInput }
  | { valid: false; error: string }

export function validateReservationInput(
  raw: unknown,
  maxPerReservation: number
): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Invalid request body' }
  }

  const r = raw as Record<string, unknown>

  if (typeof r.buyer_name !== 'string' || !r.buyer_name.trim()) {
    return { valid: false, error: 'Name is required' }
  }

  if (typeof r.buyer_email !== 'string' || !r.buyer_email.includes('@')) {
    return { valid: false, error: 'Valid email is required' }
  }

  if (typeof r.buyer_phone !== 'string' || !r.buyer_phone.trim()) {
    return { valid: false, error: 'Phone is required' }
  }

  if (!Array.isArray(r.items) || r.items.length === 0) {
    return { valid: false, error: 'At least one ticket must be selected' }
  }

  for (const item of r.items as unknown[]) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: 'Invalid item format' }
    }
    const i = item as Record<string, unknown>
    if (typeof i.ticket_type_id !== 'string' || !i.ticket_type_id) {
      return { valid: false, error: 'Invalid ticket type' }
    }
    if (
      typeof i.quantity !== 'number' ||
      !Number.isInteger(i.quantity) ||
      i.quantity < 1
    ) {
      return { valid: false, error: 'Quantity must be at least 1' }
    }
  }

  const total = (r.items as ReservationInputItem[]).reduce(
    (sum, item) => sum + item.quantity,
    0
  )
  if (total > maxPerReservation) {
    return { valid: false, error: `Maximum ${maxPerReservation} tickets per reservation` }
  }

  if (r.consent !== true) {
    return { valid: false, error: 'Consent is required' }
  }

  return {
    valid: true,
    data: {
      buyer_name: (r.buyer_name as string).trim(),
      buyer_email: (r.buyer_email as string).trim().toLowerCase(),
      buyer_phone: (r.buyer_phone as string).trim(),
      items: r.items as ReservationInputItem[],
      consent: true,
    },
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: all tests passing (14 total including Task 2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/utils/validate-reservation.ts src/lib/utils/validate-reservation.test.ts
git commit -m "feat: add reservation input validation"
```

---

## Task 4: Data layer — getEventWithTicketTypes

**Files:**
- Create: `src/lib/data/events.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/data/events.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import type { Event, TicketType } from '@/types/database'

export interface EventWithTicketTypes {
  event: Event
  ticketTypes: TicketType[]
}

export async function getEventWithTicketTypes(
  eventId: string
): Promise<EventWithTicketTypes | null> {
  const supabase = await createClient()

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single()

  if (eventError || !event) return null

  const { data: ticketTypes, error: typesError } = await supabase
    .from('ticket_types')
    .select('*')
    .eq('event_id', eventId)
    .order('sort_order')

  if (typesError || !ticketTypes) return null

  return { event, ticketTypes }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output (zero errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/events.ts
git commit -m "feat: add getEventWithTicketTypes data layer"
```

---

## Task 5: Supabase RPC migration

**Files:**
- Create: `supabase/migrations/0002_reservation_rpc.sql`

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/0002_reservation_rpc.sql`:

```sql
CREATE OR REPLACE FUNCTION create_reservation(
  p_id          text,
  p_event_id    uuid,
  p_buyer_name  text,
  p_buyer_email text,
  p_buyer_phone text,
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
  -- Lock and validate each ticket type within this transaction
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

  -- Insert reservation header
  INSERT INTO reservations (id, event_id, buyer_name, buyer_email, buyer_phone, status)
  VALUES (p_id, p_event_id, p_buyer_name, p_buyer_email, p_buyer_phone, 'active');

  -- Insert line items and increment sold counts
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

- [ ] **Step 2: Run the migration in Supabase — MANUAL STEP**

Go to **Supabase dashboard → SQL Editor**, paste the full content of `supabase/migrations/0002_reservation_rpc.sql`, and click **Run**.

Expected: "Success. No rows returned."

Verify the function exists: in SQL Editor run `SELECT proname FROM pg_proc WHERE proname = 'create_reservation';` — should return one row.

- [ ] **Step 3: Commit the migration file**

```bash
git add supabase/migrations/0002_reservation_rpc.sql
git commit -m "db: add create_reservation RPC for atomic ticket booking"
```

---

## Task 6: Data layer — createReservation

**Files:**
- Create: `src/lib/data/reservations.ts`

- [ ] **Step 1: Create the file**

Create `src/lib/data/reservations.ts`:

```typescript
import { createClient } from '@/lib/supabase/server'
import { generateReservationId } from '@/lib/utils/reservation-id'
import type { ReservationInputItem } from '@/lib/utils/validate-reservation'

export type CreateReservationResult =
  | { success: true; reservationId: string }
  | { success: false; error: 'capacity_exceeded' | 'not_found' | 'unknown' }

export async function createReservation(params: {
  eventId: string
  buyerName: string
  buyerEmail: string
  buyerPhone: string
  items: ReservationInputItem[]
}): Promise<CreateReservationResult> {
  const supabase = await createClient()
  const reservationId = generateReservationId()

  const { error } = await supabase.rpc('create_reservation', {
    p_id: reservationId,
    p_event_id: params.eventId,
    p_buyer_name: params.buyerName,
    p_buyer_email: params.buyerEmail,
    p_buyer_phone: params.buyerPhone,
    p_items: params.items,
  })

  if (error) {
    if (error.message.includes('capacity_exceeded')) {
      return { success: false, error: 'capacity_exceeded' }
    }
    if (error.message.includes('ticket_type_not_found')) {
      return { success: false, error: 'not_found' }
    }
    return { success: false, error: 'unknown' }
  }

  return { success: true, reservationId }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/lib/data/reservations.ts
git commit -m "feat: add createReservation data layer (calls Supabase RPC)"
```

---

## Task 7: API route — POST /api/reserve

**Files:**
- Create: `src/app/api/reserve/route.ts`

- [ ] **Step 1: Create the route handler**

Create `src/app/api/reserve/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateReservationInput } from '@/lib/utils/validate-reservation'
import { createReservation } from '@/lib/data/reservations'

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body || typeof body !== 'object' || typeof (body as Record<string, unknown>).event_id !== 'string') {
    return NextResponse.json({ error: 'event_id is required' }, { status: 400 })
  }

  const eventId = (body as Record<string, unknown>).event_id as string

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
    return NextResponse.json(
      { error: 'This event is not currently accepting reservations' },
      { status: 400 }
    )
  }

  const validation = validateReservationInput(body, event.max_per_reservation)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 })
  }

  const result = await createReservation({
    eventId,
    buyerName: validation.data.buyer_name,
    buyerEmail: validation.data.buyer_email,
    buyerPhone: validation.data.buyer_phone,
    items: validation.data.items,
  })

  if (!result.success) {
    if (result.error === 'capacity_exceeded') {
      return NextResponse.json(
        { error: 'Some tickets are no longer available. Please refresh and try again.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: 'Failed to create reservation' }, { status: 500 })
  }

  return NextResponse.json({ reservationId: result.reservationId })
}
```

- [ ] **Step 2: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/reserve/route.ts
git commit -m "feat: add POST /api/reserve handler"
```

---

## Task 8: TicketTypeRow component

**Files:**
- Create: `src/components/reservation/TicketTypeRow.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/reservation/TicketTypeRow.tsx`:

```tsx
'use client'

import type { TicketType } from '@/types/database'

interface Props {
  ticketType: TicketType
  quantity: number
  onChange: (ticketTypeId: string, quantity: number) => void
  /** Maximum this row may reach (considers both available capacity and reservation budget) */
  maxQuantity: number
}

export function TicketTypeRow({ ticketType, quantity, onChange, maxQuantity }: Props) {
  const available = ticketType.capacity - ticketType.sold
  const canIncrease = quantity < available && quantity < maxQuantity

  return (
    <div className="flex items-center justify-between py-4 border-b border-gray-200 last:border-0">
      <div>
        <p className="font-medium text-gray-900">{ticketType.name}</p>
        <p className="text-sm text-gray-500">LKR {ticketType.price.toLocaleString()}</p>
        <p className="text-xs text-gray-400">{available} remaining</p>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(ticketType.id, quantity - 1)}
          disabled={quantity === 0}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Decrease ${ticketType.name} quantity`}
        >
          −
        </button>
        <span className="w-6 text-center font-medium tabular-nums">{quantity}</span>
        <button
          type="button"
          onClick={() => onChange(ticketType.id, quantity + 1)}
          disabled={!canIncrease}
          className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          aria-label={`Increase ${ticketType.name} quantity`}
        >
          +
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add src/components/reservation/TicketTypeRow.tsx
git commit -m "feat: add TicketTypeRow quantity stepper component"
```

---

## Task 9: ReservationForm client component

**Files:**
- Create: `src/components/reservation/ReservationForm.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/reservation/ReservationForm.tsx`:

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Event, TicketType } from '@/types/database'
import { TicketTypeRow } from './TicketTypeRow'

interface Props {
  event: Event
  /** Only available (not-full) ticket types — filtering done by the server page */
  ticketTypes: TicketType[]
}

export function ReservationForm({ event, ticketTypes }: Props) {
  const router = useRouter()

  const [quantities, setQuantities] = useState<Record<string, number>>(
    Object.fromEntries(ticketTypes.map(t => [t.id, 0]))
  )
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const totalTickets = Object.values(quantities).reduce((sum, q) => sum + q, 0)
  // How many more tickets this reservation can still accommodate
  const remainingBudget = event.max_per_reservation - totalTickets

  function handleQuantityChange(ticketTypeId: string, quantity: number) {
    setQuantities(prev => ({ ...prev, [ticketTypeId]: quantity }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (totalTickets === 0) {
      setStatus('error')
      setErrorMessage('Please select at least one ticket.')
      return
    }

    setStatus('submitting')
    setErrorMessage('')

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }))

    try {
      const res = await fetch('/api/reserve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: event.id,
          buyer_name: buyerName,
          buyer_email: buyerEmail,
          buyer_phone: buyerPhone,
          items,
          consent,
        }),
      })

      const json = (await res.json()) as { reservationId?: string; error?: string }

      if (!res.ok) {
        setStatus('error')
        setErrorMessage(json.error ?? 'Something went wrong. Please try again.')
        return
      }

      router.push(`/ticket/${json.reservationId}`)
    } catch {
      setStatus('error')
      setErrorMessage('Network error. Please check your connection and try again.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Ticket selection */}
      <section>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Select Tickets</h2>
        <p className="text-sm text-gray-500 mb-4">
          Max {event.max_per_reservation} tickets per reservation
        </p>
        <div>
          {ticketTypes.map(ticketType => (
            <TicketTypeRow
              key={ticketType.id}
              ticketType={ticketType}
              quantity={quantities[ticketType.id] ?? 0}
              onChange={handleQuantityChange}
              maxQuantity={remainingBudget + (quantities[ticketType.id] ?? 0)}
            />
          ))}
        </div>
        {totalTickets > 0 && (
          <p className="text-sm font-medium text-gray-700 mt-3">
            {totalTickets} ticket{totalTickets !== 1 ? 's' : ''} selected
          </p>
        )}
      </section>

      {/* Buyer details */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Your Details</h2>

        <div>
          <label htmlFor="buyer_name" className="block text-sm font-medium text-gray-700 mb-1">
            Full name
          </label>
          <input
            id="buyer_name"
            type="text"
            required
            autoComplete="name"
            value={buyerName}
            onChange={e => setBuyerName(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="buyer_email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="buyer_email"
            type="email"
            required
            autoComplete="email"
            value={buyerEmail}
            onChange={e => setBuyerEmail(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="buyer_phone" className="block text-sm font-medium text-gray-700 mb-1">
            Phone number
          </label>
          <input
            id="buyer_phone"
            type="tel"
            required
            autoComplete="tel"
            value={buyerPhone}
            onChange={e => setBuyerPhone(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </section>

      {/* Consent */}
      <div className="flex items-start gap-3">
        <input
          id="consent"
          type="checkbox"
          required
          checked={consent}
          onChange={e => setConsent(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="consent" className="text-sm text-gray-600 leading-relaxed">
          I agree to share my name, email and phone number with SNT Entertainment for
          ticket fulfilment purposes.
        </label>
      </div>

      {/* Error message */}
      {status === 'error' && (
        <p role="alert" className="text-sm text-red-600 font-medium">
          {errorMessage}
        </p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="w-full rounded-md bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {status === 'submitting' ? 'Reserving…' : 'Reserve Tickets'}
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/reservation/ReservationForm.tsx
git commit -m "feat: add ReservationForm client component"
```

---

## Task 10: /reserve/[eventId] server page

**Files:**
- Create: `src/app/reserve/[eventId]/page.tsx`
- Create: `src/app/reserve/[eventId]/loading.tsx`

- [ ] **Step 1: Create the page**

Create `src/app/reserve/[eventId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getEventWithTicketTypes } from '@/lib/data/events'
import { ReservationForm } from '@/components/reservation/ReservationForm'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function ReservePage({ params }: Props) {
  const { eventId } = await params
  const data = await getEventWithTicketTypes(eventId)

  if (!data) notFound()

  const { event, ticketTypes } = data

  if (event.status !== 'published') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Event Unavailable</h1>
          <p className="mt-2 text-gray-500">
            This event is not currently accepting reservations.
          </p>
        </div>
      </main>
    )
  }

  const availableTypes = ticketTypes.filter(t => t.sold < t.capacity)

  if (availableTypes.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Sold Out</h1>
          <p className="mt-2 text-gray-500">
            All tickets for <strong>{event.name}</strong> have been reserved.
          </p>
        </div>
      </main>
    )
  }

  const eventDate = new Date(event.date_time).toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{event.name}</h1>
          <p className="text-gray-500 mt-1">
            {eventDate} · {event.venue}
          </p>
          {event.description && (
            <p className="mt-3 text-sm text-gray-600 leading-relaxed">{event.description}</p>
          )}
        </header>

        <ReservationForm event={event} ticketTypes={availableTypes} />
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Create the loading skeleton**

Create `src/app/reserve/[eventId]/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-lg mx-auto animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-3/4 mb-3" />
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-8" />
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-16 bg-gray-200 rounded" />
          ))}
        </div>
        <div className="mt-8 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-10 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-10 bg-gray-200 rounded" />
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript and build**

```bash
npx tsc --noEmit && npm run build
```

Expected: both pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/reserve/[eventId]/page.tsx src/app/reserve/[eventId]/loading.tsx
git commit -m "feat: add /reserve/[eventId] server page with sold-out states"
```

---

## Task 11: Final verification

**Files:** (no new files)

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: 14 tests passing, 0 failing.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no output.

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Smoke-test in dev**

```bash
npm run dev
```

Seed a test event directly in Supabase (SQL Editor):

```sql
INSERT INTO events (name, date_time, venue, description, status, gate_pin, max_per_reservation)
VALUES ('Test Event', now() + interval '7 days', 'Colombo', 'A test event', 'published', '123456', 10)
RETURNING id;
```

Then insert a ticket type:

```sql
INSERT INTO ticket_types (event_id, name, price, capacity, sort_order)
VALUES ('<event-id-from-above>', 'General', 2500, 100, 1);
```

Open `http://localhost:3000/reserve/<event-id>` in a browser. Verify:
- Event name, date, venue appear in the header
- Ticket type row with stepper appears
- Buyer fields and consent checkbox present
- Submit with valid data → browser redirects to `/ticket/RES-XXXXXX` (404 is expected — B2 builds that page)
- Submit with quantity 0 → inline error "Please select at least one ticket"

- [ ] **Step 6: Tag the slice**

```bash
git tag b1-reservation-form
```

---

## Spec Coverage Check

| Spec requirement | Covered by |
|---|---|
| `/reserve/[eventId]` page | Task 10 |
| Ticket selector with mixed types | Tasks 8, 9 |
| Capacity check — per-type filtering | Task 10 (server page filters available types) |
| Capacity check — atomic write | Task 5 (RPC locks rows and checks before inserting) |
| `sold` incremented on reservation | Task 5 (RPC UPDATE ticket_types) |
| Form → DB (reservation + items) | Tasks 6, 7 (createReservation + API route) |
| Sold-out per type (removed from form) | Task 10 (`availableTypes` filter) |
| Sold-out all types (full page) | Task 10 (sold-out branch) |
| `max_per_reservation` enforced | Task 3 (validation), Task 7 (API fetches event limit) |
| `buyer_name`, `buyer_email`, `buyer_phone` | Tasks 3, 9 |
| Consent checkbox | Tasks 3, 9 |
| RES-XXXXXX format | Task 2 |
| Event not published → unavailable message | Task 10 |
| Redirect to `/ticket/[id]` on success | Task 9 (`router.push`) |
