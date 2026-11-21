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
    <main className="min-h-screen bg-void px-6 py-16">
      <div className="max-w-[640px] mx-auto">

        {/* SNT wordmark */}
        <div className="mb-10">
          <span className="text-[14px] font-semibold uppercase tracking-[0.35px] text-ash-gray">
            SNT Entertainment
          </span>
        </div>

        {/* Event flyer — contained card, poster ratio */}
        <div
          className="w-full mb-12 overflow-hidden animate-fade-in"
          style={{ borderRadius: '16px', aspectRatio: '3/4', maxHeight: '480px' }}
        >
          {event.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.cover_image_url}
              alt={`${event.name} flyer`}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Placeholder when no flyer is uploaded */
            <div
              className="relative w-full h-full flex flex-col justify-end p-8"
              style={{
                background: 'linear-gradient(160deg, #0d0d1f 0%, #0a0a0a 55%, #111118 100%)',
                borderRadius: '16px',
              }}
            >
              {/* Decorative top-right accent */}
              <div
                className="absolute top-0 right-0 w-48 h-48 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at top right, rgba(128,82,255,0.15) 0%, transparent 70%)',
                  borderRadius: '0 16px 0 0',
                }}
              />
              <p
                className="text-lime-spark font-semibold uppercase mb-3"
                style={{ fontSize: '11px', letterSpacing: '0.35px' }}
              >
                Live Event
              </p>
              <p
                className="text-bone-white font-normal mb-2"
                style={{ fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.02em' }}
              >
                {event.name}
              </p>
              <p
                className="text-ash-gray font-light"
                style={{ fontSize: '14px' }}
              >
                {event.venue}
              </p>
            </div>
          )}
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
