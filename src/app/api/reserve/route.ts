import { NextRequest, NextResponse } from 'next/server'
import { validateReservationInput } from '@/lib/utils/validate-reservation'
import { createReservation } from '@/lib/data/reservations'

const MAX_PER_RESERVATION = 10

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

  const validation = validateReservationInput(body, MAX_PER_RESERVATION)
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
