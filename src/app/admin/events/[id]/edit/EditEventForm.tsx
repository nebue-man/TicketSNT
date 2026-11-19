'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generatePin } from '@/lib/utils/generate-pin'
import type { Event } from '@/types/database'

// datetime-local inputs expect 'YYYY-MM-DDTHH:MM' (no seconds/tz)
function toDateTimeLocal(isoString: string): string {
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditEventForm({ event }: { event: Event }) {
  const router = useRouter()
  const [name, setName] = useState(event.name)
  const [dateTime, setDateTime] = useState(toDateTimeLocal(event.date_time))
  const [venue, setVenue] = useState(event.venue)
  const [description, setDescription] = useState(event.description)
  const [coverUrl, setCoverUrl] = useState(event.cover_image_url ?? '')
  const [maxPer, setMaxPer] = useState(event.max_per_reservation)
  const [pin, setPin] = useState(event.gate_pin)
  const [publish, setPublish] = useState(event.status === 'published')
  const [submitting, setSubmitting] = useState(false)
  const [closing, setClosing] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        date_time: dateTime,
        venue,
        description,
        cover_image_url: coverUrl || null,
        max_per_reservation: maxPer,
        gate_pin: pin,
        status: publish ? 'published' : 'draft',
      }),
    })
    const json = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) { setError(json.error ?? 'Failed'); setSubmitting(false); return }
    router.push('/admin/events')
  }

  async function handleClose() {
    if (!window.confirm('Close this event? This cannot be undone.')) return
    setClosing(true)
    setError('')
    const res = await fetch(`/api/admin/events/${event.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'close' }),
    })
    const json = await res.json() as { ok?: boolean; error?: string }
    if (!res.ok) { setError(json.error ?? 'Failed'); setClosing(false); return }
    router.push('/admin/events')
  }

  const inputClass = 'w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]'
  const labelClass = 'block text-ash-gray font-semibold uppercase mb-3'

  const isClosed = event.status === 'closed' || event.status === 'archived'

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-10 max-w-[600px]">
      {/* Name */}
      <div>
        <label className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Event name
        </label>
        <input
          required
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          className={inputClass}
          style={{ fontSize: '18px' }}
        />
      </div>

      {/* Date / time */}
      <div>
        <label className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Date &amp; time
        </label>
        <input
          required
          type="datetime-local"
          value={dateTime}
          onChange={e => setDateTime(e.target.value)}
          className={inputClass}
          style={{ fontSize: '18px', colorScheme: 'dark' }}
        />
      </div>

      {/* Venue */}
      <div>
        <label className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Venue
        </label>
        <input
          required
          type="text"
          value={venue}
          onChange={e => setVenue(e.target.value)}
          className={inputClass}
          style={{ fontSize: '18px' }}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Description <span className="normal-case font-light text-[#555]">(optional)</span>
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={e => setDescription(e.target.value)}
          className={`${inputClass} resize-none`}
          style={{ fontSize: '16px' }}
        />
      </div>

      {/* Cover image URL */}
      <div>
        <label className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Cover image URL <span className="normal-case font-light text-[#555]">(optional)</span>
        </label>
        <input
          type="url"
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          placeholder="https://…"
          className={inputClass}
          style={{ fontSize: '18px' }}
        />
      </div>

      {/* Max per reservation */}
      <div>
        <label className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Max tickets per reservation
        </label>
        <input
          type="number"
          min={1}
          max={20}
          value={maxPer}
          onChange={e => setMaxPer(Number(e.target.value))}
          className={inputClass}
          style={{ fontSize: '18px' }}
        />
      </div>

      {/* Gate PIN */}
      <div>
        <label className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Gate PIN
        </label>
        <div className="flex items-end gap-4">
          <input
            required
            type="text"
            value={pin}
            onChange={e => setPin(e.target.value.toUpperCase())}
            className={`flex-1 ${inputClass}`}
            style={{ fontSize: '22px', fontFamily: 'monospace', letterSpacing: '0.15em' }}
          />
          <button
            type="button"
            onClick={() => setPin(generatePin())}
            className="text-ash-gray hover:text-bone-white transition-colors font-light shrink-0 pb-3"
            style={{ fontSize: '13px' }}>
            Regenerate
          </button>
        </div>
      </div>

      {/* Publish toggle */}
      <div>
        <label className="flex items-center gap-3 cursor-pointer">
          <div className="relative">
            <input
              type="checkbox"
              checked={publish}
              onChange={e => setPublish(e.target.checked)}
              className="sr-only"
            />
            <div
              className="w-10 h-6 rounded-full transition-colors duration-200"
              style={{ backgroundColor: publish ? '#7c3aed' : '#333' }}>
            </div>
            <div
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200"
              style={{ left: publish ? '22px' : '4px' }}>
            </div>
          </div>
          <span className={labelClass} style={{ fontSize: '12px', letterSpacing: '0.35px', marginBottom: 0 }}>
            Published
          </span>
        </label>
      </div>

      {error && (
        <p className="text-saffron-spark font-light" style={{ fontSize: '14px' }}>
          {error}
        </p>
      )}

      <div className="flex items-center gap-4 pt-2 flex-wrap">
        <button
          type="submit"
          disabled={submitting}
          className="bg-electric-iris text-bone-white font-semibold uppercase active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out disabled:opacity-50"
          style={{ fontSize: '13px', letterSpacing: '0.025em', borderRadius: '24px', padding: '12px 28px' }}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>

        {!isClosed && (
          <button
            type="button"
            disabled={closing}
            onClick={handleClose}
            className="text-saffron-spark hover:opacity-80 transition-opacity font-light disabled:opacity-50"
            style={{ fontSize: '13px' }}>
            {closing ? 'Closing…' : 'Close event'}
          </button>
        )}

        <button
          type="button"
          onClick={() => router.push('/admin/events')}
          className="text-ash-gray hover:text-bone-white transition-colors font-light"
          style={{ fontSize: '13px' }}>
          Cancel
        </button>
      </div>
    </form>
  )
}
