import { NextRequest, NextResponse } from 'next/server'
import { uploadOfflineScans, MAX_SCANS_PER_UPLOAD } from '@/lib/data/gate-offline'
import type { OfflineScan } from '@/lib/gate-offline/gate-list'

// Uploads a Gate phone's Offline scans when staff switch back online (ADR-0004).
export async function POST(request: NextRequest) {
  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const { eventId, gatePin, gatePhone, scans } =
    (body as { eventId?: string; gatePin?: string; gatePhone?: string; scans?: unknown }) ?? {}

  if (!eventId || !gatePin || !gatePhone?.trim() || !Array.isArray(scans)) {
    return NextResponse.json({ error: 'eventId, gatePin, gatePhone and scans are required' }, { status: 400 })
  }
  if (scans.length > MAX_SCANS_PER_UPLOAD) {
    return NextResponse.json({ error: 'too_many_scans' }, { status: 413 })
  }
  const clean: OfflineScan[] = []
  for (const s of scans as Record<string, unknown>[]) {
    if (typeof s?.reservationId !== 'string' || typeof s?.scannedAt !== 'string') {
      return NextResponse.json({ error: 'Each scan needs reservationId and scannedAt' }, { status: 400 })
    }
    clean.push({ reservationId: s.reservationId, scannedAt: s.scannedAt })
  }

  const result = await uploadOfflineScans(eventId, gatePin, gatePhone.trim().slice(0, 80), clean)
  if (!result.ok) {
    const status = result.error === 'invalid_pin' ? 403
      : result.error === 'not_found' ? 404
      : result.error === 'invalid_input' ? 400
      : 500
    return NextResponse.json({ error: result.error }, { status })
  }
  return NextResponse.json({ results: result.results }, { status: 200 })
}
