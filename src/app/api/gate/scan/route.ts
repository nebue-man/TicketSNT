import { NextRequest, NextResponse } from 'next/server'
import { scanReservation } from '@/lib/data/gate'

export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { reservationId, eventId, gatePin } =
    (body as { reservationId?: string; eventId?: string; gatePin?: string }) ?? {}

  if (!reservationId || !eventId || !gatePin) {
    return NextResponse.json({ error: 'reservationId, eventId and gatePin are required' }, { status: 400 })
  }

  const result = await scanReservation(reservationId.trim().toUpperCase(), eventId, gatePin)

  if (!result.ok) {
    const status = result.error === 'invalid_pin' ? 403
      : result.error === 'not_found' ? 404
      : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result, { status: 200 })
}
