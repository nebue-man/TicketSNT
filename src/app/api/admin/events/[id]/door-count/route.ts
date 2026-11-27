import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { getDoorCount } from '@/lib/data/admin/door-count'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const count = await getDoorCount(id)
  if (!count) return NextResponse.json({ error: 'Door count unavailable' }, { status: 500 })
  return NextResponse.json(count, { headers: { 'Cache-Control': 'no-store' } })
}
