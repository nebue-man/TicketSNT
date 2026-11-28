import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import QRCode from 'react-qr-code'
import { getEvent } from '@/lib/data/events'
import { GateScanner } from '@/components/gate/GateScanner'
import { GateSignOut } from '@/components/gate/GateSignOut'
import { requireAuth } from '@/lib/auth'

interface Props {
  params: Promise<{ eventId: string }>
  searchParams: Promise<{ pin?: string }>
}

export default async function GatePage({ params, searchParams }: Props) {
  await requireAuth()
  const { eventId } = await params
  const { pin } = await searchParams

  const event = await getEvent(eventId)
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
    <div className="min-h-screen bg-bg">
      <header className="topbar px-6">
        <div className="max-w-[480px] h-full mx-auto flex items-center justify-between">
          <span className="flex items-center gap-3">
            <span className="mark" aria-hidden="true">S</span>
            <span className="brand">SNT Gate</span>
          </span>
          <span className="text-[13px] font-medium text-muted tabular-nums">{dateStr} · {timeStr}</span>
        </div>
      </header>

      <main className="max-w-[480px] mx-auto px-6 pt-8 pb-16">
        <div className="mb-8">
          <h1 className="h1">{event.name}</h1>
          <p className="meta mt-1">{event.venue}</p>
        </div>

        {!pinProvided && (
          <section className="card p-6" aria-labelledby="gate-qr-h">
            <h2 id="gate-qr-h" className="h2 mb-2">Gate access QR</h2>
            <p className="meta mb-6">
              Show or send this QR to your gate staff. Scanning it opens the scanner directly, with no PIN to type.
            </p>
            <div className="inline-block p-4 mb-4 bg-white rounded-md">
              <QRCode value={gateUrl} size={220} bgColor="#ffffff" fgColor="#000000" />
            </div>
            <p className="mono text-[13px] text-muted break-all">{gateUrl}</p>
          </section>
        )}

        {pinProvided && !pinValid && (
          <section className="notice p-6" role="alert">
            <h2 className="h3 mb-1">Invalid access link</h2>
            <p className="meta">This gate QR code is not valid for this event. Ask the organiser for the correct link.</p>
          </section>
        )}

        {pinProvided && pinValid && (
          <>
            <GateScanner eventId={eventId} pin={pin} />
            <GateSignOut eventId={eventId} />
          </>
        )}
      </main>
    </div>
  )
}
