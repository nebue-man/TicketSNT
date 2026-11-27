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
  const toArrive = count ? Math.max(0, count.ticketsSold - count.ticketsAdmitted) : 0

  return (
    <section className="card p-6" aria-labelledby="door-count-h">
      <div className="flex justify-between items-baseline gap-4 mb-4">
        <h2 id="door-count-h" className="label">Door count</h2>
        <span className={`text-[13px] tabular-nums ${stale ? 'text-warn' : 'text-muted'}`}>
          {stale ? (time ? `Not updating · last ${time}` : 'Unavailable') : `Live · ${time}`}
        </span>
      </div>

      {count ? (
        <>
          <p className="tabular-nums mb-4" style={{ fontSize: '34px', lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.02em' }}>
            {count.ticketsAdmitted.toLocaleString()}
            <span className="text-muted" style={{ fontSize: '20px' }}> / {count.ticketsSold.toLocaleString()} admitted</span>
          </p>
          <div className="meter" role="presentation">
            <span style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <p className="meta mt-3 tabular-nums">
            Gate {count.ticketsAdmittedGate.toLocaleString()} · Box office {count.ticketsAdmittedBoxOffice.toLocaleString()} · {toArrive.toLocaleString()} still to arrive
          </p>
        </>
      ) : (
        <p className="meta">Door count unavailable. Retrying every 10 s.</p>
      )}
    </section>
  )
}
