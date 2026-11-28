import { NextRequest, NextResponse } from 'next/server'
import { decideScan } from '@/lib/data/gate'

/**
 * Scan a ticket at the gate (ADR-0005). Every Scan the server decided, including
 * Not admitted and a wrong gate PIN, answers 200 with its Scan outcome. Any
 * other status means nothing was decided, and the phone shows Not checked.
 */
export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { reservationId, eventId, gatePin } =
    (body as { reservationId?: unknown; eventId?: unknown; gatePin?: unknown }) ?? {}
  if (typeof reservationId !== 'string' || typeof eventId !== 'string' || typeof gatePin !== 'string'
    || !reservationId.trim() || !eventId || !gatePin) {
    return NextResponse.json({ error: 'reservationId, eventId and gatePin are required' }, { status: 400 })
  }

  const answer = await decideScan(reservationId, eventId, gatePin)
  if (!answer) return NextResponse.json({ error: 'Scan could not be checked' }, { status: 500 })
  return NextResponse.json(answer, { status: 200 })
}
