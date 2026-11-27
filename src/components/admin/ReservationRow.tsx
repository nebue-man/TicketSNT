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
    <li className={`card px-6 py-5 ${isVoid ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <span className="h3">{r.buyer_name}</span>
            <span className="mono text-muted text-[13px]">{r.id}</span>
            {isVoid && <span className="badge" data-status="void">Voided</span>}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 meta">
            <span>NIC {r.nic ?? '—'}</span>
            <span>{r.buyer_phone}</span>
            <span className="break-all">{r.buyer_email}</span>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {r.items.map(item => (
              <span key={item.ticket_type_name}
                className="inline-flex items-center h-7 px-3 rounded-full bg-surface-2 text-[13px] font-medium tabular-nums">
                {item.quantity} × {item.ticket_type_name}
              </span>
            ))}
            <span className="text-[13px] text-faint ml-1">{created}</span>
          </div>
          {err && <p className="field-error" role="alert">{err}</p>}
        </div>

        {!isVoid && (
          <button onClick={handleVoid} disabled={voiding} className="btn btn-secondary btn-sm shrink-0 text-danger-text">
            {voiding ? 'Voiding…' : 'Void'}
          </button>
        )}
      </div>
    </li>
  )
}
