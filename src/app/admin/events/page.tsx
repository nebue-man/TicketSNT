import Link from 'next/link'
import { getAllEvents } from '@/lib/data/admin/events'
import { StatusBadge } from '@/components/admin/StatusBadge'

export default async function AdminEventsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const showArchived = (await searchParams).archived === '1'
  const allEvents = await getAllEvents()
  const archivedCount = allEvents.filter(e => e.status === 'archived').length
  const events = allEvents.filter(e => (e.status === 'archived') === showArchived)

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="h1">{showArchived ? 'Archived events' : 'Events'}</h1>
          {(showArchived || archivedCount > 0) && (
            <Link href={showArchived ? '/admin/events' : '/admin/events?archived=1'} className="navlink mt-1">
              {showArchived ? '← Back to events' : `Show archived (${archivedCount})`}
            </Link>
          )}
        </div>
        <Link href="/admin/events/new" className="btn btn-primary">New event</Link>
      </div>

      {events.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="h3">{showArchived ? 'No archived events.' : 'No events yet.'}</p>
          {!showArchived && (
            <p className="meta mt-1">Create your first event, then add its ticket tiers.</p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {events.map(event => {
            const date = new Date(event.date_time).toLocaleDateString('en-LK', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
              timeZone: 'Asia/Colombo',
            })
            return (
              <li key={event.id} className="card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-3 mb-1">
                    <StatusBadge status={event.status} />
                    <span className="meta">{date}</span>
                  </div>
                  <p className="h3 truncate">{event.name}</p>
                  <p className="meta">{event.venue}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link href={`/admin/events/${event.id}/edit`} className="btn btn-secondary btn-sm">Edit</Link>
                  <Link href={`/admin/events/${event.id}`} className="btn btn-secondary btn-sm">Open dashboard</Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
