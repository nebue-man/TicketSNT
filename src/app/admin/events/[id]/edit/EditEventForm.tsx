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

type Action = 'close' | 'archive' | 'restore' | 'delete'

const CONFIRM: Record<Action, string> = {
  close: 'Close this event? Ticket sales stop. This cannot be undone.',
  archive: 'Archive this event? It will be hidden from your events list, but all reservations, scans and door counts are kept.\n\n' +
    'Make sure every gate phone that used offline mode has uploaded its scans first.',
  restore: 'Restore this event? It goes back in your events list as closed.',
  delete: 'Delete this event permanently? Its ticket tiers are deleted too. This cannot be undone.',
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
  const [busy, setBusy] = useState<Action | null>(null)
  const [error, setError] = useState('')
  const isClosed = event.status === 'closed' || event.status === 'archived'
  const isArchived = event.status === 'archived'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
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
          // Closed and archived events keep their status; sending the toggle would reset them to draft.
          ...(isClosed ? {} : { status: publish ? 'published' : 'draft' }),
        }),
      })
      if (res.status === 401 || res.redirected) { setError('Admin access required. Please sign in with the admin password.'); return }
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      router.push('/admin/events')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function runAction(action: Action) {
    if (!window.confirm(CONFIRM[action])) return
    setBusy(action)
    setError('')
    try {
      const res = action === 'delete'
        ? await fetch(`/api/admin/events/${event.id}`, { method: 'DELETE' })
        : await fetch(`/api/admin/events/${event.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
          })
      if (res.status === 401 || res.redirected) { setError('Admin access required. Please sign in with the admin password.'); return }
      const json = await res.json() as { ok?: boolean; error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      if (action === 'restore') router.refresh()
      else router.push('/admin/events')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setBusy(null)
    }
  }

  const inputClass = 'w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]'
  const labelClass = 'block text-ash-gray font-semibold uppercase mb-3'
  const linkButton = 'hover:opacity-80 transition-opacity font-light disabled:opacity-50'

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
          onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setMaxPer(v) }}
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

      {/* Publish toggle (closed and archived events keep their status) */}
      {!isClosed && <div>
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
      </div>}

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
            disabled={busy !== null}
            onClick={() => runAction('close')}
            className={`text-saffron-spark ${linkButton}`}
            style={{ fontSize: '13px' }}>
            {busy === 'close' ? 'Closing…' : 'Close event'}
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

      {/* Archive / restore / delete */}
      <div className="flex flex-col gap-5 pt-8 border-t border-[#1a1a1a]">
        {isArchived ? (
          <div>
            <button type="button" disabled={busy !== null} onClick={() => runAction('restore')}
              className={`text-bone-white ${linkButton}`} style={{ fontSize: '13px' }}>
              {busy === 'restore' ? 'Restoring…' : 'Restore event'}
            </button>
            <p className="text-ash-gray font-light mt-1" style={{ fontSize: '12px' }}>
              This event is archived. Restoring puts it back in your events list as closed.
            </p>
          </div>
        ) : (
          <div>
            <button type="button" disabled={busy !== null} onClick={() => runAction('archive')}
              className={`text-bone-white ${linkButton}`} style={{ fontSize: '13px' }}>
              {busy === 'archive' ? 'Archiving…' : 'Archive event'}
            </button>
            <p className="text-ash-gray font-light mt-1" style={{ fontSize: '12px' }}>
              For an event that has ended. Hides it from your events list and keeps all its records.
            </p>
          </div>
        )}
        <div>
          <button type="button" disabled={busy !== null} onClick={() => runAction('delete')}
            className={`text-saffron-spark ${linkButton}`} style={{ fontSize: '13px' }}>
            {busy === 'delete' ? 'Deleting…' : 'Delete event'}
          </button>
          <p className="text-ash-gray font-light mt-1" style={{ fontSize: '12px' }}>
            For an event made by mistake. Only works while it has no reservations.
          </p>
        </div>
      </div>
    </form>
  )
}
