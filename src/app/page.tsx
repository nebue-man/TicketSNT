import Link from 'next/link'
import { requireAuth } from '@/lib/auth'
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
    <Link
      href={`/reserve/${event.id}`}
      className="block p-6 border border-[#1a1a1a] hover:border-[#333] active:scale-[0.99] transition-[border-color,transform] duration-150 ease-out animate-fade-in-up"
      style={{ borderRadius: '16px' }}
    >
      <p className="text-lime-spark font-semibold uppercase mb-3"
        style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
        {dateStr} · {timeStr}
      </p>
      <h2 className="text-bone-white font-normal mb-1"
        style={{ fontSize: '22px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
        {event.name}
      </h2>
      <p className="text-ash-gray font-light"
        style={{ fontSize: '14px' }}>
        {event.venue}
      </p>
    </Link>
  )
}

export default async function HomePage() {
  await requireAuth()
  const events = await getUpcomingEvents()

  return (
    <main className="min-h-screen bg-void px-6 py-16">
      <div className="max-w-[640px] mx-auto">

        <div className="flex items-center justify-between mb-14">
          <div>
            <p className="text-ash-gray font-semibold uppercase"
              style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
              SNT Entertainment
            </p>
            <h1 className="text-bone-white font-normal mt-1"
              style={{ fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              Select event
            </h1>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button
              type="submit"
              className="text-ash-gray font-light hover:text-bone-white transition-colors"
              style={{ fontSize: '13px' }}
            >
              Sign out
            </button>
          </form>
        </div>

        {events.length === 0 ? (
          <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>
            No upcoming events. Create one in the{' '}
            <Link href="/admin/events" className="text-electric-iris hover:underline">
              admin portal
            </Link>
            .
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {events.map(event => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        <div className="mt-16 pt-8 border-t border-[#1a1a1a]">
          <Link
            href="/admin"
            className="text-ash-gray font-light hover:text-bone-white transition-colors"
            style={{ fontSize: '13px' }}
          >
            Admin portal →
          </Link>
        </div>

      </div>
    </main>
  )
}
