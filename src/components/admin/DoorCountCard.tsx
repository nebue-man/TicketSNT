'use client'

import { useEffect, useState } from 'react'
import type { DoorCount } from '@/lib/data/admin/door-count'

const REFRESH_MS = 10_000

/** Live Door count: tickets admitted out of tickets sold, refreshed every 10 s. */
export function DoorCountCard({ eventId, initial, loadedAt }: {
  eventId: string
  initial: DoorCount | null
  /** ISO time the server loaded `initial` (same value on server and client render). */
  loadedAt: string
}) {
  const [count, setCount] = useState<DoorCount | null>(initial)
  const [updatedAt, setUpdatedAt] = useState<Date | null>(initial ? new Date(loadedAt) : null)
  const [stale, setStale] = useState(initial === null)

  useEffect(() => {
    let cancelled = false
    async function refresh() {
      try {
        const res = await fetch(`/api/admin/events/${eventId}/door-count`, { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const next = (await res.json()) as DoorCount
        if (cancelled) return
        setCount(next)
        setUpdatedAt(new Date())
        setStale(false)
      } catch {
        if (!cancelled) setStale(true)
      }
    }
    const timer = setInterval(refresh, REFRESH_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [eventId])

  const pct = count && count.ticketsSold > 0 ? Math.min(100, Math.round((count.ticketsAdmitted / count.ticketsSold) * 100)) : 0
  const time = updatedAt?.toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Colombo' })

  return (
    <div className="p-6 border border-[#1a1a1a] mb-6" style={{ borderRadius: '16px' }}>
      <div className="flex justify-between items-baseline mb-4">
        <span className="text-ash-gray font-semibold uppercase" style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
          Door count
        </span>
        <span className="font-light" style={{ fontSize: '12px', color: stale ? '#ffb829' : '#555' }}>
          {stale ? (time ? `Not updating — last ${time}` : 'Unavailable') : `Live · ${time}`}
        </span>
      </div>

      {count ? (
        <>
          <p className="text-bone-white font-normal tabular-nums mb-4" style={{ fontSize: '34px', lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            {count.ticketsAdmitted.toLocaleString()}
            <span className="text-ash-gray" style={{ fontSize: '20px' }}> / {count.ticketsSold.toLocaleString()} admitted</span>
          </p>
          <div className="w-full h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-lime-spark transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-ash-gray font-light mt-3 tabular-nums" style={{ fontSize: '13px' }}>
            {pct}% · Gate {count.ticketsAdmittedGate.toLocaleString()} · Box office {count.ticketsAdmittedBoxOffice.toLocaleString()}
            {' · '}{(count.ticketsSold - count.ticketsAdmitted > 0 ? count.ticketsSold - count.ticketsAdmitted : 0).toLocaleString()} still to arrive
          </p>
        </>
      ) : (
        <p className="text-ash-gray font-light" style={{ fontSize: '14px' }}>Door count unavailable — retrying every 10 s.</p>
      )}
    </div>
  )
}
