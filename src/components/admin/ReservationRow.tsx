'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { Reservation } from '@/types/database'

type Props = {
  reservation: Reservation & { items: { ticket_type_name: string; quantity: number }[] }
}

export function ReservationRow({ reservation: r }: Props) {
  const router = useRouter()
  const [voiding, setVoiding] = useState(false)
  const [err, setErr] = useState('')
  const isVoid = r.status === 'void'

  async function handleVoid() {
    if (!confirm(`Void reservation ${r.id}? This cannot be undone.`)) return
    setVoiding(true)
    setErr('')
    try {
      const res = await fetch(`/api/admin/reservations/${r.id}/void`, { method: 'POST' })
      const json = await res.json() as { error?: string }
      if (!res.ok) { setErr(json.error ?? 'Failed to void'); return }
      router.refresh()
    } finally {
      setVoiding(false)
    }
  }

  const created = new Date(r.created_at).toLocaleString('en-LK', {
    dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Colombo',
  })

  return (
    <div
      className="p-5 border border-[#1a1a1a]"
      style={{ borderRadius: '12px', opacity: isVoid ? 0.5 : 1 }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <span className="text-bone-white font-semibold" style={{ fontSize: '15px' }}>
              {r.buyer_name}
            </span>
            {isVoid && (
              <span
                className="text-saffron-spark font-semibold uppercase"
                style={{ fontSize: '10px', letterSpacing: '0.35px' }}
              >
                Voided
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1">
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              {r.id}
            </span>
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              NIC: {r.nic ?? '—'}
            </span>
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              {r.buyer_phone}
            </span>
            <span className="text-ash-gray font-light" style={{ fontSize: '13px' }}>
              {r.buyer_email}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {r.items.map(item => (
              <span key={item.ticket_type_name} className="text-saffron-spark font-semibold" style={{ fontSize: '12px' }}>
                {item.quantity}× {item.ticket_type_name}
              </span>
            ))}
          </div>
          {err && (
            <p className="text-saffron-spark mt-2" style={{ fontSize: '12px' }}>
              {err}
            </p>
          )}
          <p className="text-[#444] font-light mt-2" style={{ fontSize: '12px' }}>
            {created}
          </p>
        </div>

        {!isVoid && (
          <button
            onClick={handleVoid}
            disabled={voiding}
            className="shrink-0 text-ash-gray hover:text-saffron-spark disabled:opacity-30 transition-colors font-light active:scale-95 duration-100 ease-out"
            style={{ fontSize: '12px' }}
          >
            {voiding ? 'Voiding…' : 'Void'}
          </button>
        )}
      </div>
    </div>
  )
}
