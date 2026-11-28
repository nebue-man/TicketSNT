import { NextRequest, NextResponse } from 'next/server'
import { scanReservation, type GateDoorCount, type ScanResult } from '@/lib/data/gate'
import { getDoorCount } from '@/lib/data/admin/door-count'

// The Scan is already recorded when the count is loaded: a slow count must not
// push the response past the phone's 5 s timeout and show a false "Not checked".
const DOOR_COUNT_TIMEOUT_MS = 1500

/**
 * The Door count after this Scan, sent only once the gate PIN is known to be
 * right. undefined (no section) for a wrong PIN; null ("unavailable") when the
 * PIN couldn't be checked, or the count failed or was slow. The Scan outcome
 * stands regardless.
 */
async function doorCountFor(result: ScanResult, eventId: string): Promise<GateDoorCount | null | undefined> {
  if (!result.ok && result.error === 'invalid_pin') return undefined
  if (!result.ok && result.error === 'unknown') return null
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const count = await Promise.race([
      getDoorCount(eventId),
      new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), DOOR_COUNT_TIMEOUT_MS) }),
    ])
    return count && { ticketsAdmitted: count.ticketsAdmitted, ticketsSold: count.ticketsSold }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
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
