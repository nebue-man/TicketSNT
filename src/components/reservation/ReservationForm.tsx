'use client'

import { useState } from 'react'
import QRCode from 'react-qr-code'
import type { Event, TicketType } from '@/types/database'
import { TicketTypeRow } from './TicketTypeRow'

interface Props {
  event: Event
  ticketTypes: TicketType[]
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error'

interface FieldErrors {
  buyer_name?: string
  buyer_email?: string
  buyer_phone?: string
  buyer_nic?: string
  items?: string
  consent?: string
}

interface SubmittedItem {
  name: string
  quantity: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-ash-gray font-semibold uppercase mb-6"
      style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
      {children}
    </p>
  )
}

function LineInput({
  id, label, type = 'text', autoComplete, value, onChange, error, placeholder,
}: {
  id: string; label: string; type?: string; autoComplete?: string
  value: string; onChange: (v: string) => void; error?: string; placeholder?: string
}) {
  return (
    <div className="mb-8">
      <label htmlFor={id} className="block text-ash-gray font-semibold uppercase mb-3"
        style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
        {label}
      </label>
      <input
        id={id} type={type} autoComplete={autoComplete} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]"
        style={{ fontSize: '18px' }}
      />
      {error && <p className="text-saffron-spark mt-2" style={{ fontSize: '12px' }}>{error}</p>}
    </div>
  )
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

async function downloadTicketCard(params: {
  reservationId: string
  eventName: string
  venue: string
  dateStr: string
  items: SubmittedItem[]
}) {
  const { reservationId, eventName, venue, dateStr, items } = params
  const W = 600, H = 820

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Background
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, W, H)

  // Lime accent bar
  ctx.fillStyle = '#b9ff4b'
  ctx.fillRect(40, 44, 48, 3)

  // "SNT ENTERTAINMENT" label
  ctx.fillStyle = '#9a9a9a'
  ctx.font = '600 11px system-ui, -apple-system, sans-serif'
  ctx.fillText('SNT ENTERTAINMENT', 40, 84)

  // Event name
  ctx.fillStyle = '#ffffff'
  ctx.font = '400 30px system-ui, -apple-system, sans-serif'
  const truncatedName = eventName.length > 32 ? eventName.slice(0, 32) + '…' : eventName
  ctx.fillText(truncatedName, 40, 134)

  // Date + venue
  ctx.fillStyle = '#9a9a9a'
  ctx.font = '300 15px system-ui, -apple-system, sans-serif'
  ctx.fillText(dateStr, 40, 166)
  ctx.fillText(venue, 40, 190)

  // White QR card
  const qrPad = 24
  const qrCardX = 100, qrCardY = 220, qrCardSize = 400
  ctx.fillStyle = '#ffffff'
  roundRect(ctx, qrCardX, qrCardY, qrCardSize, qrCardSize, 20)
  ctx.fill()

  // Draw QR SVG onto canvas
  const svgEl = document.getElementById('ticket-qr-svg') as SVGElement | null
  if (svgEl) {
    const svgData = new XMLSerializer().serializeToString(svgEl)
    const svgDataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData)
    await new Promise<void>((resolve) => {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, qrCardX + qrPad, qrCardY + qrPad, qrCardSize - qrPad * 2, qrCardSize - qrPad * 2)
        resolve()
      }
      img.onerror = () => resolve()
      img.src = svgDataUrl
    })
  }

  // Reservation ID
  ctx.fillStyle = '#ffffff'
  ctx.font = '600 18px system-ui, monospace'
  ctx.textAlign = 'center'
  ctx.fillText(reservationId, W / 2, 668)

  // Ticket summary
  ctx.fillStyle = '#9a9a9a'
  ctx.font = '300 14px system-ui, -apple-system, sans-serif'
  const summaryParts = items.map(i => `${i.quantity}× ${i.name}`)
  ctx.fillText(summaryParts.join('  ·  '), W / 2, 696, 520)

  // Divider
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, 724)
  ctx.lineTo(W - 40, 724)
  ctx.stroke()

  // "SHOW THIS AT THE GATE"
  ctx.fillStyle = '#b9ff4b'
  ctx.font = '600 11px system-ui, -apple-system, sans-serif'
  ctx.fillText('SHOW THIS AT THE GATE', W / 2, 760)

  ctx.textAlign = 'left'

  // Download
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reservationId}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, 'image/png')
}

export function ReservationForm({ event, ticketTypes }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerNic, setBuyerNic] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [serverError, setServerError] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [submittedItems, setSubmittedItems] = useState<SubmittedItem[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const totalTickets = Object.values(quantities).reduce((sum, q) => sum + q, 0)

  function handleQuantityChange(typeId: string, qty: number) {
    setQuantities(prev => ({ ...prev, [typeId]: qty }))
    setFieldErrors(prev => ({ ...prev, items: undefined }))
  }

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!buyerName.trim()) errors.buyer_name = 'Name is required'
    if (!buyerEmail.includes('@')) errors.buyer_email = 'Valid email is required'
    if (!buyerPhone.trim()) errors.buyer_phone = 'Phone is required'
    if (!buyerNic.trim()) errors.buyer_nic = 'NIC / Passport No. is required'
    if (totalTickets === 0) errors.items = 'Select at least one ticket'
    if (!consent) errors.consent = 'You must accept to continue'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!validate()) return
    setStatus('submitting')
    setServerError('')

    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([ticket_type_id, quantity]) => ({ ticket_type_id, quantity }))

    try {
      const res = await fetch(`/api/reserve?eventId=${event.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyer_name: buyerName, buyer_email: buyerEmail,
          buyer_phone: buyerPhone, buyer_nic: buyerNic,
          items, consent,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setStatus('error')
        setServerError(
          json.error === 'capacity_exceeded'
            ? 'Some tickets sold out while booking. Please adjust your selection.'
            : json.error ?? 'Something went wrong.'
        )
        return
      }

      const submitted: SubmittedItem[] = items.map(item => {
        const tt = ticketTypes.find(t => t.id === item.ticket_type_id)
        return { name: tt?.name ?? 'Ticket', quantity: item.quantity }
      })

      setReservationId(json.reservationId)
      setSubmittedItems(submitted)
      setStatus('success')
    } catch {
      setStatus('error')
      setServerError('Network error. Please check your connection.')
    }
  }

  function resetForm() {
    setQuantities({})
    setBuyerName('')
    setBuyerEmail('')
    setBuyerPhone('')
    setBuyerNic('')
    setConsent(false)
    setStatus('idle')
    setServerError('')
    setReservationId('')
    setSubmittedItems([])
    setFieldErrors({})
  }

  if (status === 'success') {
    const eventDate = new Date(event.date_time)
    const dateStr = eventDate.toLocaleDateString('en-LK', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'Asia/Colombo',
    })

    return (
      <div className="py-10 animate-fade-in-up">
        <p className="text-lime-spark font-semibold uppercase mb-6"
          style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
          Confirmed
        </p>
        <h2 className="text-bone-white font-normal mb-6"
          style={{ fontSize: '36px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
          Reservation created.
        </h2>
        <p className="text-ash-gray font-light mb-8" style={{ fontSize: '17px' }}>
          Download the ticket card and hand or send it to the buyer.
        </p>

        <div className="inline-block p-5 mb-6 animate-scale-in"
          style={{ background: '#ffffff', borderRadius: '16px' }}>
          <QRCode id="ticket-qr-svg" value={reservationId} size={200}
            bgColor="#ffffff" fgColor="#000000" />
        </div>

        <p className="text-ash-gray font-semibold uppercase tracking-widest mb-10"
          style={{ fontSize: '13px', letterSpacing: '0.2em' }}>
          {reservationId}
        </p>

        <div className="flex flex-col gap-4">
          <button
            onClick={() => downloadTicketCard({
              reservationId,
              eventName: event.name,
              venue: event.venue,
              dateStr,
              items: submittedItems,
            })}
            className="inline-flex items-center justify-center gap-2 bg-electric-iris text-bone-white font-semibold uppercase hover:opacity-90 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
            style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', padding: '14px 32px' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download ticket card
          </button>

          <button
            onClick={resetForm}
            className="inline-flex items-center justify-center text-ash-gray font-light hover:text-bone-white transition-colors active:scale-[0.97] duration-100 ease-out"
            style={{ fontSize: '14px', padding: '14px 32px' }}
          >
            Book next customer
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <section className="mb-14">
        <SectionLabel>Select tickets</SectionLabel>
        <div>
          {ticketTypes.map(tt => (
            <TicketTypeRow
              key={tt.id} ticketType={tt}
              quantity={quantities[tt.id] ?? 0}
              onChange={handleQuantityChange}
              max={event.max_per_reservation}
            />
          ))}
        </div>
        {fieldErrors.items && (
          <p className="text-saffron-spark mt-4" style={{ fontSize: '12px' }}>
            {fieldErrors.items}
          </p>
        )}
        <p className="text-ash-gray font-light mt-4" style={{ fontSize: '14px' }}>
          Maximum {event.max_per_reservation} tickets per reservation.
          {totalTickets > 0 && (
            <span className="text-lime-spark ml-2 font-semibold">{totalTickets} selected.</span>
          )}
        </p>
      </section>

      <section className="mb-10">
        <SectionLabel>Buyer details</SectionLabel>
        <LineInput id="buyer_name" label="Full name" autoComplete="name"
          value={buyerName} onChange={v => { setBuyerName(v); setFieldErrors(p => ({ ...p, buyer_name: undefined })) }}
          error={fieldErrors.buyer_name} placeholder="Full name" />
        <LineInput id="buyer_email" label="Email" type="email" autoComplete="email"
          value={buyerEmail} onChange={v => { setBuyerEmail(v); setFieldErrors(p => ({ ...p, buyer_email: undefined })) }}
          error={fieldErrors.buyer_email} placeholder="email@example.com" />
        <LineInput id="buyer_phone" label="Phone" type="tel" autoComplete="tel"
          value={buyerPhone} onChange={v => { setBuyerPhone(v); setFieldErrors(p => ({ ...p, buyer_phone: undefined })) }}
          error={fieldErrors.buyer_phone} placeholder="+94 77 000 0000" />
        <LineInput id="buyer_nic" label="NIC / Passport No."
          value={buyerNic} onChange={v => { setBuyerNic(v); setFieldErrors(p => ({ ...p, buyer_nic: undefined })) }}
          error={fieldErrors.buyer_nic} placeholder="200012345678 or A12345678" />
      </section>

      <div className="flex gap-4 mb-12">
        <button type="button" role="checkbox" aria-checked={consent}
          onClick={() => { setConsent(c => !c); setFieldErrors(p => ({ ...p, consent: undefined })) }}
          className="mt-1 w-5 h-5 rounded border shrink-0 flex items-center justify-center active:scale-90 transition-[transform,background-color,border-color] duration-100 ease-out"
          style={{ borderColor: consent ? '#8052ff' : '#333', backgroundColor: consent ? '#8052ff' : 'transparent' }}>
          {consent && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <label className="text-ash-gray font-light cursor-pointer" style={{ fontSize: '15px', lineHeight: 1.5 }}
          onClick={() => { setConsent(c => !c); setFieldErrors(p => ({ ...p, consent: undefined })) }}>
          Buyer consents to their details being used to process this reservation.
        </label>
      </div>
      {fieldErrors.consent && (
        <p className="text-saffron-spark -mt-8 mb-10" style={{ fontSize: '12px' }}>{fieldErrors.consent}</p>
      )}

      {status === 'error' && serverError && (
        <p className="text-saffron-spark mb-8" style={{ fontSize: '15px' }}>{serverError}</p>
      )}

      <button type="submit" disabled={status === 'submitting'}
        className="inline-flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase disabled:opacity-40 hover:opacity-90 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
        style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', paddingTop: '14.4px', paddingBottom: '14.4px', paddingLeft: '32px', paddingRight: '32px', minWidth: '200px' }}>
        {status === 'submitting'
          ? 'Creating reservation…'
          : totalTickets > 0
            ? `Confirm ${totalTickets} ticket${totalTickets > 1 ? 's' : ''}`
            : 'Confirm reservation'}
      </button>
    </form>
  )
}
