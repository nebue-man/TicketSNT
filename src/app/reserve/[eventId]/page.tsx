import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getEventWithTicketTypes } from '@/lib/data/events'
import { ReservationForm } from '@/components/reservation/ReservationForm'
import { requireAuth } from '@/lib/auth'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function ReservePage({ params }: Props) {
  await requireAuth()
  const { eventId } = await params
  const data = await getEventWithTicketTypes(eventId)

  if (!data || data.event.status === 'closed' || data.event.status === 'archived') notFound()

  const { event, ticketTypes } = data

  const eventDate = new Date(event.date_time)
  const dateStr = eventDate.toLocaleDateString('en-LK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Colombo',
  })
  const timeStr = eventDate.toLocaleTimeString('en-LK', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Colombo',
  })

  return (
    <div className="min-h-screen bg-bg">
      <header className="topbar px-6">
        <div className="max-w-[1024px] h-full mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <span className="mark" aria-hidden="true">S</span>
            <span className="brand">SNT Counter</span>
          </Link>
          <Link href="/" className="navlink">All events</Link>
        </div>
      </header>

      <main className="max-w-[1024px] mx-auto px-6 pt-10 pb-24 grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
        {/* Event: flyer and details; sticks beside the form on wide screens */}
        <aside className="lg:sticky lg:top-[104px] self-start">
          <div className="card overflow-hidden mb-6 aspect-[4/5] max-h-[320px] lg:max-h-none w-full">
            {event.cover_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.cover_image_url} alt={`${event.name} flyer`} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col justify-end p-6 bg-surface">
                <span className="mark mb-4" aria-hidden="true">S</span>
                <p className="h2">{event.name}</p>
                <p className="meta">{event.venue}</p>
              </div>
            )}
          </div>
          <h1 className="h1 mb-3">{event.name}</h1>
          <dl className="flex flex-col gap-1 meta">
            <div><dt className="sr-only">Date</dt><dd className="text-ink">{dateStr}</dd></div>
            <div><dt className="sr-only">Time</dt><dd className="tabular-nums">{timeStr} Sri Lanka time</dd></div>
            <div><dt className="sr-only">Venue</dt><dd>{event.venue}</dd></div>
          </dl>
        </aside>

        <ReservationForm event={event} ticketTypes={ticketTypes} />
      </main>
    </div>
  )
}
