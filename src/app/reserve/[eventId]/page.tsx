import { notFound } from 'next/navigation'
import { getEventWithTicketTypes } from '@/lib/data/events'
import { ReservationForm } from '@/components/reservation/ReservationForm'

interface Props {
  params: Promise<{ eventId: string }>
}

export default async function ReservePage({ params }: Props) {
  const { eventId } = await params
  const data = await getEventWithTicketTypes(eventId)

  if (!data || data.event.status !== 'published') notFound()

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
    <main className="min-h-screen bg-void px-6 py-16">
      <div className="max-w-[640px] mx-auto">

        {/* SNT wordmark */}
        <div className="mb-16">
          <span className="text-[14px] font-semibold uppercase tracking-[0.35px] text-ash-gray">
            SNT Entertainment
          </span>
        </div>

        {/* Event header */}
        <header className="mb-14">
          <p className="text-[14px] font-semibold uppercase tracking-[0.35px] text-lime-spark mb-4">
            Live Event
          </p>
          <h1
            className="text-bone-white font-normal mb-4"
            style={{ fontSize: '42px', lineHeight: 1.2, letterSpacing: '-1.68px' }}
          >
            {event.name}
          </h1>
          <p className="text-ash-gray font-light" style={{ fontSize: '18px' }}>
            {dateStr} · {timeStr} (Sri Lanka time)
          </p>
          <p className="text-ash-gray font-light" style={{ fontSize: '18px' }}>
            {event.venue}
          </p>
        </header>

        <ReservationForm event={event} ticketTypes={ticketTypes} />

      </div>
    </main>
  )
}
