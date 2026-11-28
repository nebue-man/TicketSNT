import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createEvent } from '@/lib/data/admin/events'

export async function POST(req: NextRequest) {
  await requireAuth('admin')
  const body = await req.json() as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const date_time = typeof body.date_time === 'string' ? body.date_time : ''
  const venue = typeof body.venue === 'string' ? body.venue.trim() : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''
  const cover_image_url = typeof body.cover_image_url === 'string' && body.cover_image_url.trim()
    ? body.cover_image_url.trim() : null
  const max_per_reservation = typeof body.max_per_reservation === 'number' && body.max_per_reservation >= 1
    ? body.max_per_reservation : 6
  const gate_pin = typeof body.gate_pin === 'string' ? body.gate_pin.trim().toUpperCase() : ''
  const status = body.status === 'published' ? 'published' : 'draft' as const

  if (!name || !date_time || !venue || !gate_pin) {
    return NextResponse.json({ error: 'name, date_time, venue, gate_pin are required' }, { status: 422 })
  }

  const result = await createEvent({ name, date_time, venue, description, cover_image_url, max_per_reservation, gate_pin, status })
  if (!result.ok) return NextResponse.json({ error: 'Failed to create event. Please try again.' }, { status: 500 })

  return NextResponse.json({ id: result.id }, { status: 201 })
}
