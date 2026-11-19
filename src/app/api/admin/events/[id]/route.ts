import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { updateEvent, closeEvent } from '@/lib/data/admin/events'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const body = await req.json() as Record<string, unknown>
  const ok = await updateEvent(id, body)
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
