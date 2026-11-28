import { NextRequest, NextResponse } from 'next/server'
import { validateReservationInput } from '@/lib/utils/validate-reservation'
import { validateDoorSale } from '@/lib/utils/validate-door-sale'
import { createReservation } from '@/lib/data/reservations'
import { getEvent } from '@/lib/data/events'
import { DbFailure } from '@/lib/data/db'
import type { Event } from '@/types/database'

// ADR-0006: a failed database call is an outage, not a refusal; the buyer can try again.
const UNAVAILABLE = { error: 'Something went wrong. Please try again in a moment.' }

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

  let event: Event | null
  try {
    event = await getEvent(eventId)
  } catch (err) {
    if (err instanceof DbFailure) return NextResponse.json(UNAVAILABLE, { status: 503 })
    throw err
  }

  if (!event) {
    return NextResponse.json({ error: 'Event not found' }, { status: 404 })
  }

  if (event.status === 'closed' || event.status === 'archived') {
    return NextResponse.json({ error: 'Event is not accepting reservations' }, { status: 400 })
  }

  const validation = validateReservationInput(body, event.max_per_reservation)
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 })
  }

  const doorSale = validateDoorSale((body as Record<string, unknown>).door_sale)
  if (!doorSale.valid) {
    return NextResponse.json({ error: doorSale.error }, { status: 422 })
  }

  const result = await createReservation(eventId, validation.data, doorSale.doorSale)

  if (!result.ok) {
    if (result.error === 'failed') return NextResponse.json(UNAVAILABLE, { status: 503 })
    const status = result.error === 'capacity_exceeded' ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ reservationId: result.reservationId }, { status: 201 })
}
