'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { generatePin } from '@/lib/utils/generate-pin'
import { EventFields, PublishSwitch, type EventFieldValues } from '@/components/admin/EventFields'

export default function NewEventPage() {
  const router = useRouter()
  const [values, setValues] = useState<EventFieldValues>(() => ({
    name: '', dateTime: '', venue: '', description: '', coverUrl: '', maxPer: 6, pin: generatePin(),
  }))
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
          name: values.name,
          date_time: values.dateTime,
          venue: values.venue,
          description: values.description,
          cover_image_url: values.coverUrl || null,
          max_per_reservation: values.maxPer,
          gate_pin: values.pin,
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

  return (
    <div className="max-w-[640px]">
      <div className="mb-8">
        <Link href="/admin/events" className="navlink">← Events</Link>
        <h1 className="h1 mt-1">New event</h1>
        <p className="meta mt-1">You add ticket tiers on the next screen.</p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 flex flex-col gap-6">
        <EventFields values={values} onChange={patch => setValues(v => ({ ...v, ...patch }))} placeholders />

        <PublishSwitch checked={publish} onChange={setPublish} label="Publish now"
          hint="Leave off to save it as a draft and publish later." />

        {error && <p className="field-error mt-0" role="alert">{error}</p>}

        <div className="flex flex-wrap gap-3 pt-2 border-t border-line">
          <button type="submit" disabled={submitting} className="btn btn-primary mt-6">
            {submitting ? 'Creating…' : 'Create event'}
          </button>
          <Link href="/admin/events" className="btn btn-secondary mt-6">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
