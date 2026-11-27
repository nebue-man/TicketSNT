'use client'

import type { TicketType } from '@/types/database'

interface Props {
  ticketType: TicketType
  quantity: number
  onChange: (typeId: string, quantity: number) => void
  max: number
}

const stepButton =
  'w-11 h-11 rounded-full grid place-content-center text-ink text-[20px] leading-none ' +
  'transition-[background-color,transform] duration-150 ease-out hover:bg-white/10 active:scale-[0.92] ' +
  'disabled:opacity-30 disabled:hover:bg-transparent'

export function TicketTypeRow({ ticketType, quantity, onChange, max }: Props) {
  const available = ticketType.capacity - ticketType.sold
  const effectiveMax = Math.min(max, available)
  const soldOut = available <= 0
  const lowStock = !soldOut && available <= 10
  const selected = quantity > 0

  return (
    <div
      className={`card flex items-center justify-between gap-4 pl-5 pr-3 py-3 min-h-[76px] transition-[border-color,background-color] duration-200 ease-out ${soldOut ? 'opacity-60' : ''}`}
      style={selected ? { borderColor: 'rgb(185 255 75 / 0.45)', background: 'color-mix(in oklab, var(--color-accent) 5%, var(--color-surface))' } : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className="h3 truncate">{ticketType.name}</p>
        <div className="flex items-center gap-3 flex-wrap">
          <p className="meta tabular-nums">LKR {ticketType.price.toLocaleString()}</p>
          {soldOut && <span className="text-[13px] font-medium text-muted">Sold out</span>}
          {lowStock && <span className="text-[13px] font-medium text-warn tabular-nums">{available} left</span>}
        </div>
      </div>

      <div className="shrink-0">
        {soldOut ? null : selected ? (
          <div className="flex items-center rounded-full bg-surface-2 animate-scale-in">
            <button
              type="button"
              aria-label={`Remove one ${ticketType.name}`}
              onClick={() => onChange(ticketType.id, quantity - 1)}
              className={stepButton}
            >
              −
            </button>
            <span key={quantity} className="min-w-7 text-center font-medium tabular-nums text-accent animate-scale-in" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label={`Add one ${ticketType.name}`}
              disabled={quantity >= effectiveMax}
              onClick={() => onChange(ticketType.id, quantity + 1)}
              className={stepButton}
            >
              +
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`Add ${ticketType.name}`}
            onClick={() => onChange(ticketType.id, 1)}
            className="btn btn-secondary btn-sm h-11"
          >
            <svg width="12" height="12" viewBox="0 0 10 10" fill="none" aria-hidden="true">
              <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Add
          </button>
        )}
      </div>
    </div>
  )
}
