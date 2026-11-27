'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { generatePin } from '@/lib/utils/generate-pin'
import { NumberInput } from '@/components/NumberInput'

export default function NewEventPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [dateTime, setDateTime] = useState('')
  const [venue, setVenue] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [maxPer, setMaxPer] = useState(6)
  const [pin, setPin] = useState(() => generatePin())
  const [publish, setPublish] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
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
      if (res.status === 401 || res.redirected) { setError('Admin access required. Please sign in with the admin password.'); return }
      const json = await res.json() as { id?: string; error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed'); return }
      router.push(`/admin/events/${json.id}/tiers`)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass = 'w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]'
  const labelClass = 'block text-ash-gray font-semibold uppercase mb-3'

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-bone-white font-normal" style={{ fontSize: '28px', letterSpacing: '-0.02em' }}>
          New event
        </h1>
      </div>

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
            placeholder="e.g. SNT Exclusive Night"
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
            placeholder="e.g. Colombo Hilton"
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
            placeholder="A brief description of the event…"
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
          <NumberInput
            min={1}
            max={20}
            value={maxPer}
            onChange={setMaxPer}
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
              Publish immediately
            </span>
          </label>
          <p className="text-[#555] font-light mt-2" style={{ fontSize: '12px' }}>
            Leave off to save as draft and publish later.
          </p>
        </div>

        {error && (
          <p className="text-saffron-spark font-light" style={{ fontSize: '14px' }}>
            {error}
          </p>
        )}

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="bg-electric-iris text-bone-white font-semibold uppercase active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out disabled:opacity-50"
            style={{ fontSize: '13px', letterSpacing: '0.025em', borderRadius: '24px', padding: '12px 28px' }}>
            {submitting ? 'Creating…' : 'Create event →'}
          </button>
        </div>
      </form>
    </div>
  )
}
