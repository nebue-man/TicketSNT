import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { updateEvent, closeEvent } from '@/lib/data/admin/events'
import type { EventInsert } from '@/lib/data/admin/events'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const body = await req.json() as Record<string, unknown>

  const patch: Partial<EventInsert> = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.date_time === 'string' && body.date_time) patch.date_time = body.date_time
  if (typeof body.venue === 'string' && body.venue.trim()) patch.venue = body.venue.trim()
  if (typeof body.description === 'string') patch.description = body.description.trim()
  if (body.cover_image_url === null || (typeof body.cover_image_url === 'string' && body.cover_image_url.trim()))
    patch.cover_image_url = body.cover_image_url === null ? null : (body.cover_image_url as string).trim()
  if (typeof body.max_per_reservation === 'number' && body.max_per_reservation >= 1)
    patch.max_per_reservation = body.max_per_reservation
  if (typeof body.gate_pin === 'string' && body.gate_pin.trim()) patch.gate_pin = body.gate_pin.trim().toUpperCase()
  if (body.status === 'published' || body.status === 'draft') patch.status = body.status

  const ok = await updateEvent(id, patch)
  if (!ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const body = await req.json() as { action?: string }
  if (body.action === 'close') {
    const ok = await closeEvent(id)
    if (!ok) return NextResponse.json({ error: 'Failed to close event' }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
