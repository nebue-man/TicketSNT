import { NextRequest, NextResponse } from 'next/server'
import { validateReservationInput } from '@/lib/utils/validate-reservation'
import { createReservation } from '@/lib/data/reservations'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Event } from '@/types/database'

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

  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: eventRows, error: eventError } = await (supabase as any).rpc('admin_get_event', { p_id: eventId })

  if (eventError) {
    console.error('Event fetch error:', eventError)
    return NextResponse.json({ error: 'Failed to load event' }, { status: 500 })
  }

  const event = ((eventRows as Event[] | null)?.[0]) ?? null

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

  const result = await createReservation(eventId, validation.data)

  if (!result.ok) {
    const status = result.error === 'capacity_exceeded' ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json({ reservationId: result.reservationId }, { status: 201 })
}
