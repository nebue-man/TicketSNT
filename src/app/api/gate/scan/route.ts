import { NextRequest, NextResponse } from 'next/server'
import { scanReservation, type GateDoorCount, type ScanResult } from '@/lib/data/gate'
import { getDoorCount } from '@/lib/data/admin/door-count'

/**
 * The Door count after this Scan, sent only once the gate PIN is known to be
 * right: a wrong PIN, or a failure before the PIN was checked, reveals nothing.
 * null if the count couldn't be loaded; the Scan outcome stands regardless.
 */
async function doorCountFor(result: ScanResult, eventId: string): Promise<GateDoorCount | null | undefined> {
  if (!result.ok && (result.error === 'invalid_pin' || result.error === 'unknown')) return undefined
  const count = await getDoorCount(eventId)
  return count && { ticketsAdmitted: count.ticketsAdmitted, ticketsSold: count.ticketsSold }
}

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
  const doorCount = await doorCountFor(result, eventId)

  if (!result.ok) {
    const status = result.error === 'invalid_pin' ? 403
      : result.error === 'not_found' ? 404
      : 400
    return NextResponse.json({ error: result.error, doorCount }, { status })
  }

  return NextResponse.json({ ...result, doorCount }, { status: 200 })
}
