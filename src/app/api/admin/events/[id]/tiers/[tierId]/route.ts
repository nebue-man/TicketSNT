import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { updateTier, deleteTier } from '@/lib/data/admin/tiers'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
  await requireAuth('admin')
  const { tierId } = await params
  const body = await req.json() as Record<string, unknown>

  const patch: { name?: string; price?: number; capacity?: number } = {}
  if (typeof body.name === 'string' && body.name.trim()) patch.name = body.name.trim()
  if (typeof body.price === 'number' && body.price >= 0) patch.price = body.price
  if (typeof body.capacity === 'number' && body.capacity >= 1) patch.capacity = body.capacity

  const result = await updateTier(tierId, patch)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ tierId: string }> }) {
  await requireAuth('admin')
  const { tierId } = await params
  const result = await deleteTier(tierId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
