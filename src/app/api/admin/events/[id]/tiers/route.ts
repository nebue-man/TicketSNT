import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { createTier } from '@/lib/data/admin/tiers'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id: eventId } = await params
  const body = await req.json() as Record<string, unknown>

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const price = typeof body.price === 'number' && body.price >= 0 ? body.price : null
  const capacity = typeof body.capacity === 'number' && body.capacity >= 1 ? body.capacity : null
  const sort_order = typeof body.sort_order === 'number' ? body.sort_order : 0

  if (!name || price === null || capacity === null) {
    return NextResponse.json({ error: 'name, price, capacity are required' }, { status: 422 })
  }

  const result = await createTier(eventId, { name, price, capacity, sort_order })
  if (!result.ok) return NextResponse.json({ error: 'Failed to create tier' }, { status: 500 })

  return NextResponse.json({ ok: true }, { status: 201 })
}
