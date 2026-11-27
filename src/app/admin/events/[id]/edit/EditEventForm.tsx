'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { EventFields, PublishSwitch, type EventFieldValues } from '@/components/admin/EventFields'
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
  const [values, setValues] = useState<EventFieldValues>({
    name: event.name,
    dateTime: toDateTimeLocal(event.date_time),
    venue: event.venue,
    description: event.description,
    coverUrl: event.cover_image_url ?? '',
    maxPer: event.max_per_reservation,
    pin: event.gate_pin,
  })
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
          name: values.name,
          date_time: values.dateTime,
          venue: values.venue,
          description: values.description,
          cover_image_url: values.coverUrl || null,
          max_per_reservation: values.maxPer,
          gate_pin: values.pin,
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

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSubmit} className="card p-6 sm:p-8 flex flex-col gap-6">
        <EventFields values={values} onChange={patch => setValues(v => ({ ...v, ...patch }))} />

        {/* Closed and archived events keep their status */}
        {!isClosed && <PublishSwitch checked={publish} onChange={setPublish} label="Published" />}

        {error && <p className="field-error mt-0" role="alert">{error}</p>}

        <div className="flex flex-wrap gap-3 pt-6 border-t border-line">
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving…' : 'Save changes'}
          </button>
          <button type="button" onClick={() => router.push('/admin/events')} className="btn btn-secondary">
            Cancel
          </button>
        </div>
      </form>

      <section className="card p-6 sm:p-8" aria-labelledby="event-actions-h">
        <h2 id="event-actions-h" className="h2 mb-2">Close, archive or delete</h2>
        <ul className="divide-y divide-line">
          {!isClosed && (
            <ActionRow
              title="Close event"
              text="Stops ticket sales now. This cannot be undone."
              button={busy === 'close' ? 'Closing…' : 'Close event'}
              disabled={busy !== null}
              onClick={() => runAction('close')}
              danger
            />
          )}
          {isArchived ? (
            <ActionRow
              title="Restore event"
              text="Puts it back in your events list as closed."
              button={busy === 'restore' ? 'Restoring…' : 'Restore event'}
              disabled={busy !== null}
              onClick={() => runAction('restore')}
            />
          ) : (
            <ActionRow
              title="Archive event"
              text="For an event that has ended. Hides it from your events list and keeps all its records."
              button={busy === 'archive' ? 'Archiving…' : 'Archive event'}
              disabled={busy !== null}
              onClick={() => runAction('archive')}
            />
          )}
          <ActionRow
            title="Delete event"
            text="For an event made by mistake. Only works while it has no reservations."
            button={busy === 'delete' ? 'Deleting…' : 'Delete event'}
            disabled={busy !== null}
            onClick={() => runAction('delete')}
            danger
          />
        </ul>
      </section>
    </div>
  )
}

function ActionRow({ title, text, button, disabled, onClick, danger }: {
  title: string
  text: string
  button: string
  disabled: boolean
  onClick: () => void
  danger?: boolean
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-4 py-4">
      <div className="min-w-0 flex-1 basis-64">
        <p className="font-medium">{title}</p>
        <p className="meta">{text}</p>
      </div>
      <button type="button" disabled={disabled} onClick={onClick}
        className={`btn btn-secondary btn-sm shrink-0 ${danger ? 'text-danger-text' : ''}`}>
        {button}
      </button>
    </li>
  )
}
