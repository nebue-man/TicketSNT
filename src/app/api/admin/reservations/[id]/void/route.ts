import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { voidReservation } from '@/lib/data/admin/reservations'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const ok = await voidReservation(id)
  if (!ok) return NextResponse.json({ error: 'Failed to void reservation' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
