import Link from 'next/link'
import { requireAuth, getSessionRole } from '@/lib/auth'
import { getUpcomingEvents } from '@/lib/data/events'
import type { Event } from '@/types/database'

function EventCard({ event }: { event: Event }) {
  const date = new Date(event.date_time)
  const dateStr = date.toLocaleDateString('en-LK', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'Asia/Colombo',
  })
  const timeStr = date.toLocaleTimeString('en-LK', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Colombo',
  })

  return (
    <li>
      <Link href={`/reserve/${event.id}`} className="card card-link group flex items-center justify-between gap-6 p-6">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-accent tabular-nums mb-2">{dateStr} · {timeStr}</p>
          <h2 className="h2 truncate">{event.name}</h2>
          <p className="meta">{event.venue}</p>
        </div>
        <svg className="shrink-0 text-muted transition-transform duration-150 group-hover:translate-x-[3px] group-hover:text-ink"
          width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </li>
  )
}

export default async function HomePage() {
  await requireAuth()
  const [events, role] = await Promise.all([getUpcomingEvents(), getSessionRole()])

  return (
    <div className="min-h-screen bg-bg">
      <header className="topbar px-6">
        <div className="max-w-[640px] h-full mx-auto flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span className="mark" aria-hidden="true">S</span>
            <span className="brand">SNT Counter</span>
          </span>
          <div className="flex items-center gap-6">
            {role === 'admin' && <Link href="/admin" className="navlink">Admin</Link>}
            <form action="/api/auth/logout" method="POST">
              <button type="submit" className="navlink">Sign out</button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-6 pt-12 pb-24">
        <h1 className="h1 mb-2">Choose an event</h1>
        <p className="meta mb-8">Book a reservation or sell at the door.</p>

        {events.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="h3">No upcoming events.</p>
            {role === 'admin' && (
              <p className="meta mt-1">
                Create one in the <Link href="/admin/events" className="link">admin portal</Link>.
              </p>
            )}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}
