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

  return (
    <div className="flex items-center justify-between py-5 border-b border-[#1a1a1a] last:border-0">
      <div className="flex-1 min-w-0 mr-6">
        <p
          className="text-bone-white font-normal"
          style={{ fontSize: '18px', lineHeight: 1.3 }}
        >
          {ticketType.name}
        </p>
        <p
          className="text-saffron-spark font-semibold mt-1"
          style={{ fontSize: '14px', letterSpacing: '0.35px' }}
        >
          LKR {ticketType.price.toLocaleString()}
        </p>
        {soldOut && (
          <p className="text-ash-gray mt-1" style={{ fontSize: '12px', letterSpacing: '0.35px', textTransform: 'uppercase' }}>
            Sold out
          </p>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <button
          type="button"
          aria-label={`Decrease ${ticketType.name}`}
          disabled={quantity <= 0}
          onClick={() => onChange(ticketType.id, quantity - 1)}
          className="w-8 h-8 rounded-full border border-ash-gray flex items-center justify-center text-bone-white disabled:opacity-20 hover:border-bone-white active:scale-90 transition-[transform,border-color] duration-100 ease-out"
          style={{ fontSize: '18px', lineHeight: 1 }}
        >
          −
        </button>
        <span
          className="font-normal tabular-nums transition-colors duration-150"
          style={{ fontSize: '18px', minWidth: '20px', textAlign: 'center', color: quantity > 0 ? '#b9ff4b' : '#ffffff' }}
        >
          {quantity}
        </span>
        <button
          type="button"
          aria-label={`Increase ${ticketType.name}`}
          disabled={soldOut || quantity >= effectiveMax}
          onClick={() => onChange(ticketType.id, quantity + 1)}
          className="w-8 h-8 rounded-full border border-ash-gray flex items-center justify-center text-bone-white disabled:opacity-20 hover:border-bone-white active:scale-90 transition-[transform,border-color] duration-100 ease-out"
          style={{ fontSize: '18px', lineHeight: 1 }}
        >
          +
        </button>
      </div>
    </div>
  )
}
