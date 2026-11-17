import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import QRCode from 'react-qr-code'
import { getEventForGate } from '@/lib/data/events'
import { GateScanner } from '@/components/gate/GateScanner'

interface Props {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ pin?: string }>
}

export default async function GatePage({ params, searchParams }: Props) {
  const { eventId } = await params
  const { pin } = await searchParams

  const event = await getEventForGate(eventId)
  if (!event || event.status === 'archived') notFound()

  const eventDate = new Date(event.date_time)
  const dateStr = eventDate.toLocaleDateString('en-LK', {
    weekday: 'short', month: 'short', day: 'numeric',
    timeZone: 'Asia/Colombo',
  })
  const timeStr = eventDate.toLocaleTimeString('en-LK', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Colombo',
  })

  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http'
  const gateUrl = `${proto}://${host}/gate/${eventId}?pin=${event.gate_pin}`

  const pinProvided = pin !== undefined
  const pinValid = pin === event.gate_pin

  return (
    <main className="min-h-screen bg-void px-6 py-12">
      <div className="max-w-[480px] mx-auto">

        <div className="mb-10">
          <span className="text-ash-gray font-semibold uppercase" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
            SNT · Gate
          </span>
        </div>

        <header className="mb-10">
          <p className="text-saffron-spark font-semibold uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
            {dateStr} · {timeStr}
          </p>
          <h1 className="text-bone-white font-normal" style={{ fontSize: '27px', lineHeight: 1.2 }}>
            {event.name}
          </h1>
          <p className="text-ash-gray font-light mt-1" style={{ fontSize: '15px' }}>
            {event.venue}
          </p>
        </header>

        {!pinProvided && (
          <div>
            <p className="text-lime-spark font-semibold uppercase mb-6" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
              Gate access QR
            </p>
            <p className="text-silver-mist font-light mb-8" style={{ fontSize: '15px' }}>
              Show or send this QR to your gate staff. Scanning it opens the scanner directly — no PIN entry needed.
            </p>
            <div className="inline-block p-5 mb-6" style={{ background: '#ffffff', borderRadius: '16px' }}>
              <QRCode value={gateUrl} size={220} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <p className="text-ash-gray font-light" style={{ fontSize: '12px', wordBreak: 'break-all' }}>
              {gateUrl}
            </p>
          </div>
        )}

        {pinProvided && !pinValid && (
          <div>
            <p className="text-saffron-spark font-semibold uppercase mb-4" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
              Invalid access link
            </p>
            <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>
              This gate QR code is not valid for this event. Ask the organiser for the correct link.
            </p>
          </div>
        )}

        {pinProvided && pinValid && (
          <GateScanner eventId={eventId} pin={pin} />
        )}

      </div>
    </main>
  )
}
