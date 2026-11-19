import Link from 'next/link'
import { getAllEvents } from '@/lib/data/admin/events'
import type { EventStatus } from '@/types/database'

function StatusBadge({ status }: { status: EventStatus }) {
  const colors: Record<EventStatus, string> = {
    published: '#b9ff4b',
    draft: '#9a9a9a',
    closed: '#ffb829',
    archived: '#444',
  }
  return (
    <span className="font-semibold uppercase" style={{ fontSize: '11px', letterSpacing: '0.35px', color: colors[status] }}>
      {status}
    </span>
  )
}

export default async function AdminEventsPage() {
  const events = await getAllEvents()

  return (
    <div>
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-bone-white font-normal"
          style={{ fontSize: '28px', letterSpacing: '-0.02em' }}>
          Events
        </h1>
        <Link href="/admin/events/new"
          className="inline-flex items-center gap-2 bg-electric-iris text-bone-white font-semibold uppercase active:scale-[0.97] transition-transform duration-100 ease-out"
          style={{ fontSize: '13px', letterSpacing: '0.025em', borderRadius: '24px', padding: '10px 20px' }}>
          + New event
        </Link>
      </div>

      {events.length === 0 ? (
        <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>No events yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {events.map(event => {
            const date = new Date(event.date_time).toLocaleDateString('en-LK', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              timeZone: 'Asia/Colombo',
            })
            return (
              <div key={event.id}
                className="flex items-center justify-between p-5 border border-[#1a1a1a]"
                style={{ borderRadius: '12px' }}>
                <div className="flex-1 min-w-0 mr-6">
                  <div className="flex items-center gap-3 mb-1">
                    <StatusBadge status={event.status} />
                    <span className="text-ash-gray font-light" style={{ fontSize: '12px' }}>
                      {date}
                    </span>
                  </div>
                  <p className="text-bone-white font-normal truncate" style={{ fontSize: '17px' }}>
                    {event.name}
                  </p>
                  <p className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
                    {event.venue}
                  </p>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <Link href={`/admin/events/${event.id}`}
                    className="text-ash-gray hover:text-bone-white transition-colors font-light"
                    style={{ fontSize: '13px' }}>
                    Dashboard
                  </Link>
                  <Link href={`/admin/events/${event.id}/edit`}
                    className="text-electric-iris hover:opacity-80 transition-opacity font-light"
                    style={{ fontSize: '13px' }}>
                    Edit
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
