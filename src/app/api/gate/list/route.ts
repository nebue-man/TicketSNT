import { NextRequest, NextResponse } from 'next/server'
import { getGateList } from '@/lib/data/gate-offline'

// Downloads the Gate list for offline mode (ADR-0004). Needs the event's gate PIN.
export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { eventId, gatePin } = (body as { eventId?: string; gatePin?: string }) ?? {}
  if (!eventId || !gatePin) {
    return NextResponse.json({ error: 'eventId and gatePin are required' }, { status: 400 })
  }

  const result = await getGateList(eventId, gatePin)
  if (!result.ok) {
    const status = result.error === 'invalid_pin' ? 403 : result.error === 'not_found' ? 404 : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json(result.payload, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
