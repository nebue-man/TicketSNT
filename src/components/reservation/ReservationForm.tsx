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

/** Ordinary Reservation, or a Door sale (admitted now, or entered from paper). */
type SaleType = 'reservation' | 'door_now' | 'door_paper'

const SALE_TYPES: { value: SaleType; label: string; hint: string }[] = [
  { value: 'reservation', label: 'Reservation', hint: 'Buyer is scanned in at the gate.' },
  { value: 'door_now', label: 'Door sale', hint: 'Sold at the box office now — buyer is admitted immediately, no gate scan needed.' },
  { value: 'door_paper', label: 'From paper', hint: 'Door sale written on paper during an outage — buyer is already inside. Enter the time on the paper.' },
]

/** Current local time as a datetime-local input value (YYYY-MM-DDTHH:MM). */
function nowForInput(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

interface FieldErrors {
  paper_time?: string
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
  return <h2 className="h2 mb-4">{children}</h2>
}

function LineInput({
  id, label, type = 'text', autoComplete, value, onChange, error, placeholder,
}: {
  id: string; label: string; type?: string; autoComplete?: string
  value: string; onChange: (v: string) => void; error?: string; placeholder?: string
}) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">{label}</label>
      <input
        id={id} type={type} autoComplete={autoComplete} value={value} placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className="input"
      />
      {error && <p id={`${id}-error`} className="field-error">{error}</p>}
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
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // The page's own faces (next/font gives them generated family names)
  const sans = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif'
  const mono = getComputedStyle(document.documentElement).getPropertyValue('--font-dm-mono').trim() || 'ui-monospace, monospace'

  // Background
  ctx.fillStyle = '#0f0f0f'
  ctx.fillRect(0, 0, W, H)

  // Brand mark: lime square with an S
  ctx.fillStyle = '#b9ff4b'
  roundRect(ctx, 40, 40, 32, 32, 9)
  ctx.fill()
  ctx.fillStyle = '#0f0f0f'
  ctx.font = `600 16px ${sans}`
  ctx.textAlign = 'center'
  ctx.fillText('S', 56, 62)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#ffffff'
  ctx.font = `500 15px ${sans}`
  ctx.fillText('SNT Entertainment', 84, 61)

  // Event name
  ctx.fillStyle = '#ffffff'
  ctx.font = `500 30px ${sans}`
  const truncatedName = eventName.length > 32 ? eventName.slice(0, 32) + '…' : eventName
  ctx.fillText(truncatedName, 40, 134)

  // Date + venue
  ctx.fillStyle = '#8f8f8f'
  ctx.font = `400 15px ${sans}`
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
  ctx.font = `500 18px ${mono}`
  ctx.textAlign = 'center'
  ctx.fillText(reservationId, W / 2, 668)

  // Ticket summary
  ctx.fillStyle = '#8f8f8f'
  ctx.font = `400 15px ${sans}`
  const summaryParts = items.map(i => `${i.quantity} × ${i.name}`)
  ctx.fillText(summaryParts.join('  ·  '), W / 2, 696, 520)

  // Divider
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(40, 724)
  ctx.lineTo(W - 40, 724)
  ctx.stroke()

  // Instruction
  ctx.fillStyle = '#b9ff4b'
  ctx.font = `500 15px ${sans}`
  ctx.fillText('Show this at the gate', W / 2, 762)

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
  const [saleType, setSaleType] = useState<SaleType>('reservation')
  const [paperTime, setPaperTime] = useState('')
  const [submittedSaleType, setSubmittedSaleType] = useState<SaleType>('reservation')

  const totalTickets = Object.values(quantities).reduce((sum, q) => sum + q, 0)
  const isDoorSale = saleType !== 'reservation'

  function chooseSaleType(next: SaleType) {
    setSaleType(next)
    if (next === 'door_paper' && !paperTime) setPaperTime(nowForInput())
    setFieldErrors(p => ({ ...p, paper_time: undefined }))
  }

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
    if (saleType === 'door_paper' && (!paperTime || Number.isNaN(new Date(paperTime).getTime()))) {
      errors.paper_time = 'Enter the time written on the paper'
    }
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
          door_sale: saleType === 'door_now' ? { mode: 'now' }
            : saleType === 'door_paper' ? { mode: 'paper', admitted_at: new Date(paperTime).toISOString() }
            : undefined,
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
      setSubmittedSaleType(saleType)
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
    // saleType and the last paper time are kept: the box office usually enters
    // several Door sales in a row, and paper slips come in time order.
  }

  if (status === 'success') {
    const eventDate = new Date(event.date_time)
    const dateStr = eventDate.toLocaleDateString('en-LK', {
      weekday: 'short', month: 'short', day: 'numeric',
      timeZone: 'Asia/Colombo',
    })

    return (
      <section className="card p-6 sm:p-8 animate-fade-in-up" aria-labelledby="sale-done-h">
        <span className="badge" data-status="published">
          {submittedSaleType === 'reservation' ? 'Confirmed' : 'Admitted at box office'}
        </span>
        <h2 id="sale-done-h" className="h1 mt-3 mb-2">
          {submittedSaleType === 'reservation' ? 'Reservation created.'
            : submittedSaleType === 'door_now' ? 'Door sale done. Let them in.'
            : 'Paper sale entered.'}
        </h2>
        <p className="meta mb-8 max-w-[52ch]">
          {submittedSaleType === 'reservation'
            ? 'Download the ticket card and hand or send it to the buyer.'
            : 'Already admitted: this QR shows “Already scanned” at the gate. No gate scan needed.'}
        </p>

        <div className="flex flex-wrap items-center gap-6 mb-8">
          <div className="p-4 bg-white rounded-md animate-scale-in">
            <QRCode id="ticket-qr-svg" value={reservationId} size={176}
              bgColor="#ffffff" fgColor="#000000" />
          </div>
          <div>
            <p className="label mb-1">Reservation ID</p>
            <p className="mono text-[20px] mb-3">{reservationId}</p>
            <ul className="flex flex-col gap-1">
              {submittedItems.map(item => (
                <li key={item.name} className="tabular-nums">{item.quantity} × {item.name}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => downloadTicketCard({
              reservationId,
              eventName: event.name,
              venue: event.venue,
              dateStr,
              items: submittedItems,
            }).catch(err => console.error('Ticket download failed', err))}
            className="btn btn-primary"
          >
            <svg width="16" height="16" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <path d="M7 1v8M4 6l3 3 3-3M2 11h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Download ticket card
          </button>
          <button onClick={resetForm} className="btn btn-secondary">
            {submittedSaleType === 'door_paper' ? 'Enter next paper sale' : 'Book next customer'}
          </button>
        </div>
      </section>
    )
  }

  const saleHint = SALE_TYPES.find(t => t.value === saleType)!.hint

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-10 min-w-0">
      <section aria-label="Sale type">
        <div className="seg" role="group" aria-label="Sale type">
          {SALE_TYPES.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => chooseSaleType(t.value)}
              aria-pressed={saleType === t.value}
              data-tone={t.value === 'reservation' ? undefined : 'warn'}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className={`hint ${isDoorSale ? 'text-warn' : ''}`}>{saleHint}</p>
        {saleType === 'door_paper' && (
          <div className="mt-6 max-w-[320px]">
            <LineInput id="paper_time" label="Time on the paper" type="datetime-local"
              value={paperTime} onChange={v => { setPaperTime(v); setFieldErrors(p => ({ ...p, paper_time: undefined })) }}
              error={fieldErrors.paper_time} />
          </div>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 mb-4">
          <h2 className="h2">Tickets</h2>
          <p className="meta tabular-nums" aria-live="polite">
            {totalTickets > 0
              ? <span className="text-accent font-medium">{totalTickets} of {event.max_per_reservation} selected</span>
              : `Up to ${event.max_per_reservation} per reservation`}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {ticketTypes.map(tt => (
            <TicketTypeRow
              key={tt.id} ticketType={tt}
              quantity={quantities[tt.id] ?? 0}
              onChange={handleQuantityChange}
              max={event.max_per_reservation}
            />
          ))}
        </div>
        {fieldErrors.items && <p className="field-error" role="alert">{fieldErrors.items}</p>}
      </section>

      <section>
        <SectionLabel>Buyer details</SectionLabel>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <LineInput id="buyer_name" label="Full name" autoComplete="name"
              value={buyerName} onChange={v => { setBuyerName(v); setFieldErrors(p => ({ ...p, buyer_name: undefined })) }}
              error={fieldErrors.buyer_name} />
          </div>
          <LineInput id="buyer_email" label="Email" type="email" autoComplete="email"
            value={buyerEmail} onChange={v => { setBuyerEmail(v); setFieldErrors(p => ({ ...p, buyer_email: undefined })) }}
            error={fieldErrors.buyer_email} placeholder="name@example.com" />
          <LineInput id="buyer_phone" label="Phone" type="tel" autoComplete="tel"
            value={buyerPhone} onChange={v => { setBuyerPhone(v); setFieldErrors(p => ({ ...p, buyer_phone: undefined })) }}
            error={fieldErrors.buyer_phone} placeholder="+94 77 000 0000" />
          <div className="sm:col-span-2">
            <LineInput id="buyer_nic" label="NIC or passport number"
              value={buyerNic} onChange={v => { setBuyerNic(v); setFieldErrors(p => ({ ...p, buyer_nic: undefined })) }}
              error={fieldErrors.buyer_nic} placeholder="200012345678 or A12345678" />
          </div>
        </div>

        <div className="mt-6">
          <label htmlFor="consent" className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox" id="consent" checked={consent}
              onChange={e => { setConsent(e.target.checked); setFieldErrors(p => ({ ...p, consent: undefined })) }}
              aria-invalid={fieldErrors.consent ? true : undefined}
              aria-describedby={fieldErrors.consent ? 'consent-error' : undefined}
              className="check"
            />
            <span className="text-[15px] leading-normal">
              Buyer consents to their details being used to process this reservation.
            </span>
          </label>
          {fieldErrors.consent && <p id="consent-error" className="field-error pl-8">{fieldErrors.consent}</p>}
        </div>
      </section>

      <div className="flex flex-col gap-4 pt-6 border-t border-line">
        {status === 'error' && serverError && (
          <p className="notice" role="alert">{serverError}</p>
        )}
        <button type="submit" disabled={status === 'submitting'} className="btn btn-primary btn-lg sm:self-start sm:min-w-[260px]">
          {status === 'submitting'
            ? (isDoorSale ? 'Admitting…' : 'Creating reservation…')
            : saleType === 'door_now'
              ? `Sell & admit${totalTickets > 0 ? ` ${totalTickets} ticket${totalTickets > 1 ? 's' : ''}` : ''}`
              : saleType === 'door_paper'
                ? `Enter paper sale${totalTickets > 0 ? ` · ${totalTickets} ticket${totalTickets > 1 ? 's' : ''}` : ''}`
                : totalTickets > 0
                  ? `Confirm ${totalTickets} ticket${totalTickets > 1 ? 's' : ''}`
                  : 'Confirm reservation'}
        </button>
      </div>
    </form>
  )
}
