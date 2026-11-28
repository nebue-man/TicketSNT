import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { updateEvent, closeEvent, deleteEvent, archiveEvent, restoreEvent } from '@/lib/data/admin/events'
import type { EventInsert, EventWrite } from '@/lib/data/admin/events'

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

  return eventResponse(await updateEvent(id, patch))
}

type EventRefusal = 'not_found' | 'has_reservations' | 'not_archived' | 'failed'

const REFUSALS: Record<EventRefusal, [string, number]> = {
  not_found:        ['Event not found', 404],
  has_reservations: ['This event has reservations, so it can’t be deleted. Archive it instead.', 409],
  not_archived:     ['This event isn’t archived.', 409],
  failed:           ['Something went wrong. Please try again.', 500],
}

function eventResponse(result: EventWrite<EventRefusal>) {
  if (result.ok) return NextResponse.json({ ok: true })
  const [error, status] = REFUSALS[result.reason]
  return NextResponse.json({ error }, { status })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const body = await req.json() as { action?: string }
  if (body.action === 'close') return eventResponse(await closeEvent(id))
  if (body.action === 'archive') return eventResponse(await archiveEvent(id))
  if (body.action === 'restore') return eventResponse(await restoreEvent(id))
  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  return eventResponse(await deleteEvent(id))
}
