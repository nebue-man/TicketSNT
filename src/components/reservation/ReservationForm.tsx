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
  items?: string
  consent?: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-ash-gray font-semibold uppercase mb-6" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
      {children}
    </p>
  )
}

function LineInput({
  id, label, type = 'text', autoComplete, value, onChange, error, placeholder,
}: {
  id: string
  label: string
  type?: string
  autoComplete?: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
}) {
  return (
    <div className="mb-8">
      <label htmlFor={id} className="block text-ash-gray font-semibold uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        autoComplete={autoComplete}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]"
        style={{ fontSize: '18px' }}
      />
      {error && (
        <p className="text-saffron-spark mt-2" style={{ fontSize: '12px' }}>{error}</p>
      )}
    </div>
  )
}

export function ReservationForm({ event, ticketTypes }: Props) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [status, setStatus] = useState<FormStatus>('idle')
  const [serverError, setServerError] = useState('')
  const [reservationId, setReservationId] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  function handleQuantityChange(typeId: string, qty: number) {
    setQuantities(prev => ({ ...prev, [typeId]: qty }))
    setFieldErrors(prev => ({ ...prev, items: undefined }))
  }

  const totalTickets = Object.values(quantities).reduce((sum, q) => sum + q, 0)

  function validate(): boolean {
    const errors: FieldErrors = {}
    if (!buyerName.trim()) errors.buyer_name = 'Name is required'
    if (!buyerEmail.includes('@')) errors.buyer_email = 'Valid email is required'
    if (!buyerPhone.trim()) errors.buyer_phone = 'Phone is required'
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
        body: JSON.stringify({ buyer_name: buyerName, buyer_email: buyerEmail, buyer_phone: buyerPhone, items, consent }),
      })
      const json = await res.json()

      if (!res.ok) {
        setStatus('error')
        setServerError(
          json.error === 'capacity_exceeded'
            ? 'Some tickets sold out while you were booking. Please adjust your selection.'
            : json.error ?? 'Something went wrong. Please try again.'
        )
        return
      }

      setReservationId(json.reservationId)
      setStatus('success')
    } catch {
      setStatus('error')
      setServerError('Network error. Please check your connection and try again.')
    }
  }

  if (status === 'success') {
    return (
      <div className="py-16">
        <p className="text-lime-spark font-semibold uppercase mb-6" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
          Confirmed
        </p>
        <h2 className="text-bone-white font-normal mb-6" style={{ fontSize: '36px', lineHeight: 1.2 }}>
          You&apos;re on the list.
        </h2>
        <p className="text-ash-gray font-light mb-8" style={{ fontSize: '18px' }}>
          Show this QR code at the gate.
        </p>

        {/* QR code — white background required for scanner contrast */}
        <div className="inline-block p-5 mb-8" style={{ background: '#ffffff', borderRadius: '16px' }}>
          <QRCode value={reservationId} size={200} bgColor="#ffffff" fgColor="#000000" />
        </div>

        <p
          className="text-ash-gray font-semibold uppercase tracking-widest mb-8"
          style={{ fontSize: '13px', letterSpacing: '0.2em' }}
        >
          {reservationId}
        </p>
        <p className="text-silver-mist font-light" style={{ fontSize: '14px' }}>
          A confirmation has been sent to {buyerEmail}.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>

      {/* Ticket selection */}
      <section className="mb-14">
        <SectionLabel>Select tickets</SectionLabel>

        <div>
          {ticketTypes.map(tt => (
            <TicketTypeRow
              key={tt.id}
              ticketType={tt}
              quantity={quantities[tt.id] ?? 0}
              onChange={handleQuantityChange}
              max={event.max_per_reservation}
            />
          ))}
        </div>

        {fieldErrors.items && (
          <p className="text-saffron-spark mt-4" style={{ fontSize: '12px' }}>{fieldErrors.items}</p>
        )}
        <p className="text-ash-gray font-light mt-4" style={{ fontSize: '14px' }}>
          Maximum {event.max_per_reservation} tickets per reservation.
          {totalTickets > 0 && (
            <span className="text-lime-spark ml-2 font-semibold">{totalTickets} selected.</span>
          )}
        </p>
      </section>

      {/* Contact details */}
      <section className="mb-10">
        <SectionLabel>Your details</SectionLabel>

        <LineInput
          id="buyer_name"
          label="Full name"
          autoComplete="name"
          value={buyerName}
          onChange={v => { setBuyerName(v); setFieldErrors(p => ({ ...p, buyer_name: undefined })) }}
          error={fieldErrors.buyer_name}
          placeholder="Your full name"
        />
        <LineInput
          id="buyer_email"
          label="Email"
          type="email"
          autoComplete="email"
          value={buyerEmail}
          onChange={v => { setBuyerEmail(v); setFieldErrors(p => ({ ...p, buyer_email: undefined })) }}
          error={fieldErrors.buyer_email}
          placeholder="you@example.com"
        />
        <LineInput
          id="buyer_phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={buyerPhone}
          onChange={v => { setBuyerPhone(v); setFieldErrors(p => ({ ...p, buyer_phone: undefined })) }}
          error={fieldErrors.buyer_phone}
          placeholder="+94 77 000 0000"
        />
      </section>

      {/* Consent */}
      <div className="flex gap-4 mb-12">
        <button
          type="button"
          role="checkbox"
          aria-checked={consent}
          onClick={() => { setConsent(c => !c); setFieldErrors(p => ({ ...p, consent: undefined })) }}
          className="mt-1 w-5 h-5 rounded border shrink-0 flex items-center justify-center transition-colors"
          style={{
            borderColor: consent ? '#8052ff' : '#333',
            backgroundColor: consent ? '#8052ff' : 'transparent',
          }}
        >
          {consent && (
            <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
              <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
        <label
          className="text-ash-gray font-light cursor-pointer"
          style={{ fontSize: '15px', lineHeight: 1.5 }}
          onClick={() => { setConsent(c => !c); setFieldErrors(p => ({ ...p, consent: undefined })) }}
        >
          I agree to my contact details being used to process this reservation.
        </label>
      </div>
      {fieldErrors.consent && (
        <p className="text-saffron-spark -mt-8 mb-10" style={{ fontSize: '12px' }}>{fieldErrors.consent}</p>
      )}

      {/* Server error */}
      {status === 'error' && serverError && (
        <p className="text-saffron-spark mb-8" style={{ fontSize: '15px' }}>{serverError}</p>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="inline-flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase disabled:opacity-40 transition-opacity hover:opacity-90"
        style={{
          fontSize: '14px',
          letterSpacing: '0.025em',
          borderRadius: '24px',
          paddingTop: '14.4px',
          paddingBottom: '14.4px',
          paddingLeft: '32px',
          paddingRight: '32px',
          minWidth: '200px',
        }}
      >
        {status === 'submitting'
          ? 'Reserving…'
          : totalTickets > 0
            ? `Reserve ${totalTickets} ticket${totalTickets > 1 ? 's' : ''}`
            : 'Reserve tickets'}
      </button>

    </form>
  )
}
