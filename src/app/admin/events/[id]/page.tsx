import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getAdminEvent } from '@/lib/data/admin/events'
import { getEventStats } from '@/lib/data/admin/reservations'
import { getDoorCount } from '@/lib/data/admin/door-count'
import { DoorCountCard } from '@/components/admin/DoorCountCard'
import { getOfflineScanIssues } from '@/lib/data/gate-offline'
import { OfflineScanIssues } from '@/components/admin/OfflineScanIssues'
import { StatusBadge } from '@/components/admin/StatusBadge'

export default async function EventDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [event, stats, doorCount, offlineIssues] = await Promise.all([
    getAdminEvent(id), getEventStats(id), getDoorCount(id), getOfflineScanIssues(id),
  ])
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
      <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
        <div className="min-w-0">
          <StatusBadge status={event.status} />
          <h1 className="h1 mt-2">{event.name}</h1>
          <p className="meta mt-1">{event.venue} · {eventDate}</p>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="Event">
          <Link href={`/admin/events/${id}/reservations`} className="btn btn-primary btn-sm">Reservations</Link>
          <Link href={`/admin/events/${id}/tiers`} className="btn btn-secondary btn-sm">Tiers</Link>
          <Link href={`/gate/${id}`} className="btn btn-secondary btn-sm">Gate</Link>
          <Link href={`/admin/events/${id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
        </nav>
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-3">
        <DoorCountCard eventId={id} initial={doorCount} loadedAt={new Date().toISOString()} />

        <section className="card p-6" aria-labelledby="capacity-h">
          <div className="flex justify-between items-baseline mb-4">
            <h2 id="capacity-h" className="label">Tickets sold</h2>
            <span className="meta tabular-nums">{pct}%</span>
          </div>
          <p className="tabular-nums mb-4" style={{ fontSize: '34px', lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.02em' }}>
            {totalSold.toLocaleString()}
            <span className="text-muted" style={{ fontSize: '20px' }}> / {totalCapacity.toLocaleString()}</span>
          </p>
          <div className="meter" role="presentation">
            <span data-tone={pct >= 90 ? 'warn' : undefined} style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <p className="meta mt-3 tabular-nums">{totalRemaining.toLocaleString()} remaining</p>
        </section>
      </div>

      <OfflineScanIssues issues={offlineIssues} />

      <section className="mt-10" aria-labelledby="tiers-h">
        <h2 id="tiers-h" className="h2 mb-4">Tiers</h2>
        {stats.length === 0 ? (
          <div className="card p-6">
            <p className="meta">
              No tiers yet.{' '}
              <Link href={`/admin/events/${id}/tiers`} className="link">Add tiers</Link>
            </p>
          </div>
        ) : (
          <ul className="card divide-y divide-line">
            {stats.map(tier => {
              const tierPct = tier.capacity > 0 ? Math.round((tier.sold / tier.capacity) * 100) : 0
              return (
                <li key={tier.id} className="flex items-center justify-between gap-6 px-6 py-4">
                  <div className="min-w-0">
                    <p className="h3">{tier.name}</p>
                    <p className="meta">LKR {tier.price.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="hidden sm:block w-32">
                      <div className="meter">
                        <span data-tone={tierPct >= 90 ? 'warn' : undefined} style={{ transform: `scaleX(${tierPct / 100})` }} />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="tabular-nums font-medium">{tier.sold} / {tier.capacity}</p>
                      <p className="meta tabular-nums">{tier.remaining} left</p>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
