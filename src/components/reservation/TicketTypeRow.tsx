'use client'

import type { TicketType } from '@/types/database'

interface Props {
  ticketType: TicketType
  quantity: number
  onChange: (typeId: string, quantity: number) => void
  max: number
}

export function TicketTypeRow({ ticketType, quantity, onChange, max }: Props) {
  const available = ticketType.capacity - ticketType.sold
  const effectiveMax = Math.min(max, available)
  const soldOut = available <= 0
  const lowStock = !soldOut && available <= 10
  const selected = quantity > 0

  return (
    <div
      className="flex items-center justify-between p-5 mb-3 last:mb-0 transition-[background-color,border-color] duration-300 ease-out"
      style={{
        borderRadius: '16px',
        border: selected ? '1px solid rgba(185,255,75,0.2)' : '1px solid #1a1a1a',
        backgroundColor: selected ? 'rgba(185,255,75,0.04)' : 'transparent',
      }}
    >
      {/* Ticket info */}
      <div className="flex-1 min-w-0 mr-6">
        <p className="text-bone-white font-normal" style={{ fontSize: '17px', lineHeight: 1.3 }}>
          {ticketType.name}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <p className="text-saffron-spark font-semibold" style={{ fontSize: '14px' }}>
            LKR {ticketType.price.toLocaleString()}
          </p>
          {soldOut && (
            <span className="text-ash-gray uppercase" style={{ fontSize: '10px', letterSpacing: '0.4px' }}>
              Sold out
            </span>
          )}
          {lowStock && (
            <span className="text-saffron-spark uppercase" style={{ fontSize: '10px', letterSpacing: '0.4px' }}>
              {available} left
            </span>
          )}
        </div>
      </div>

      {/* Stepper */}
      <div className="shrink-0">
        {soldOut ? (
          <span className="text-[#333]" style={{ fontSize: '15px' }}>—</span>
        ) : selected ? (
          /* Active stepper pill — springs in, number springs on each change */
          <div
            className="flex items-center animate-scale-in"
            style={{
              borderRadius: '24px',
              backgroundColor: 'rgba(185,255,75,0.1)',
              border: '1px solid rgba(185,255,75,0.25)',
              padding: '2px',
            }}
          >
            <button
              type="button"
              aria-label={`Decrease ${ticketType.name}`}
              onClick={() => onChange(ticketType.id, quantity - 1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-bone-white hover:bg-white/5 active:scale-[0.88] transition-transform duration-75 ease-out"
              style={{ fontSize: '18px', lineHeight: 1 }}
            >
              −
            </button>

            <span
              key={quantity}
              className="font-semibold tabular-nums animate-scale-in"
              style={{ fontSize: '15px', minWidth: '22px', textAlign: 'center', color: '#b9ff4b' }}
            >
              {quantity}
            </span>

            <button
              type="button"
              aria-label={`Increase ${ticketType.name}`}
              disabled={quantity >= effectiveMax}
              onClick={() => onChange(ticketType.id, quantity + 1)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-bone-white disabled:opacity-25 hover:bg-white/5 active:scale-[0.88] transition-transform duration-75 ease-out"
              style={{ fontSize: '18px', lineHeight: 1 }}
            >
              +
            </button>
          </div>
        ) : (
          /* "Add" pill — shown when qty = 0 */
          <button
            type="button"
            aria-label={`Add ${ticketType.name}`}
            onClick={() => onChange(ticketType.id, 1)}
            className="flex items-center gap-1.5 text-lime-spark font-semibold hover:opacity-80 active:scale-[0.92] transition-[transform,opacity] duration-75 ease-out"
            style={{
              fontSize: '13px',
              letterSpacing: '0.025em',
              borderRadius: '24px',
              border: '1px solid rgba(185,255,75,0.35)',
              padding: '7px 14px',
            }}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add
          </button>
        )}
      </div>
    </div>
  )
}
