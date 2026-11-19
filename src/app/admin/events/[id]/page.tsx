import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminEvent } from '@/lib/data/admin/events'
import { getEventStats } from '@/lib/data/admin/reservations'
import type { EventStatus } from '@/types/database'

function statusColor(status: EventStatus): string {
  const colors: Record<EventStatus, string> = {
    published: '#b9ff4b',
    draft: '#9a9a9a',
    closed: '#ffb829',
    archived: '#444',
  }
  return colors[status]
}

export default async function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [event, stats] = await Promise.all([getAdminEvent(id), getEventStats(id)])
  if (!event) notFound()

  const totalCapacity = stats.reduce((s, t) => s + t.capacity, 0)
  const totalSold = stats.reduce((s, t) => s + t.sold, 0)
  const totalRemaining = totalCapacity - totalSold
  const pct = totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0

  const eventDate = new Date(event.date_time).toLocaleDateString('en-LK', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Colombo',
  })

  return (
    <div>
      <div className="flex items-start justify-between mb-10">
        <div>
          <span
            className="font-semibold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.35px', color: statusColor(event.status) }}
          >
            {event.status}
          </span>
          <h1
            className="text-bone-white font-normal mt-2"
            style={{ fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.02em' }}
          >
            {event.name}
          </h1>
          <p className="text-ash-gray font-light mt-1" style={{ fontSize: '14px' }}>
            {event.venue} · {eventDate}
          </p>
        </div>
        <div className="flex gap-4 shrink-0 mt-1">
          <Link
            href={`/admin/events/${id}/tiers`}
            className="text-ash-gray hover:text-bone-white transition-colors font-light"
            style={{ fontSize: '13px' }}
          >
            Tiers
          </Link>
          <Link
            href={`/admin/events/${id}/reservations`}
            className="text-electric-iris hover:opacity-80 transition-opacity font-light"
            style={{ fontSize: '13px' }}
          >
            Reservations
          </Link>
          <Link
            href={`/admin/events/${id}/edit`}
            className="text-ash-gray hover:text-bone-white transition-colors font-light"
            style={{ fontSize: '13px' }}
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Total capacity bar */}
      <div className="p-6 border border-[#1a1a1a] mb-6" style={{ borderRadius: '16px' }}>
        <div className="flex justify-between mb-4">
          <span
            className="text-ash-gray font-semibold uppercase"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}
          >
            Total capacity
          </span>
          <span className="text-bone-white font-semibold" style={{ fontSize: '15px' }}>
            {totalSold} / {totalCapacity} · {pct}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: pct >= 90 ? '#ffb829' : '#b9ff4b',
            }}
          />
        </div>
        <p className="text-ash-gray font-light mt-3" style={{ fontSize: '13px' }}>
          {totalRemaining} remaining
        </p>
      </div>

      {/* Per-tier breakdown */}
      {stats.length === 0 ? (
        <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>
          No tiers yet.{' '}
          <Link href={`/admin/events/${id}/tiers`} className="text-electric-iris hover:underline">
            Add tiers →
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {stats.map(tier => {
            const tierPct = tier.capacity > 0 ? Math.round((tier.sold / tier.capacity) * 100) : 0
            return (
              <div
                key={tier.id}
                className="flex items-center justify-between p-5 border border-[#1a1a1a]"
                style={{ borderRadius: '12px' }}
              >
                <div>
                  <p className="text-bone-white font-normal" style={{ fontSize: '16px' }}>
                    {tier.name}
                  </p>
                  <p className="text-saffron-spark font-semibold mt-0.5" style={{ fontSize: '13px' }}>
                    LKR {tier.price.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className="text-bone-white font-semibold tabular-nums"
                    style={{ fontSize: '16px' }}
                  >
                    {tier.sold} / {tier.capacity}
                  </p>
                  <p className="text-ash-gray font-light mt-0.5" style={{ fontSize: '12px' }}>
                    {tier.remaining} left · {tierPct}%
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
