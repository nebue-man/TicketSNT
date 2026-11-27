'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { TicketType } from '@/types/database'
import { NumberInput } from '@/components/NumberInput'

interface Props {
  tiers: TicketType[]
  eventId: string
}

export function TiersList({ tiers, eventId }: Props) {
  const router = useRouter()

  if (tiers.length === 0) {
    return (
      <div className="card p-6">
        <p className="meta">No tiers yet. Add the first one below.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {tiers.map(tier => (
        <TierRow key={tier.id} tier={tier} eventId={eventId} onRefresh={() => router.refresh()} />
      ))}
    </ul>
  )
}

function TierRow({ tier, eventId, onRefresh }: { tier: TicketType; eventId: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(tier.name)
  const [price, setPrice] = useState(tier.price)
  const [capacity, setCapacity] = useState(tier.capacity)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState('')

  async function handleSave() {
    setSaving(true)
    setErr('')
    const res = await fetch(`/api/admin/events/${eventId}/tiers/${tier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, capacity }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setErr(json.error ?? 'Failed'); setSaving(false); return }
    setEditing(false)
    setSaving(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete tier "${tier.name}"?`)) return
    setDeleting(true)
    const res = await fetch(`/api/admin/events/${eventId}/tiers/${tier.id}`, { method: 'DELETE' })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setErr(json.error ?? 'Failed'); setDeleting(false); return }
    setDeleting(false)
    onRefresh()
  }

  const pct = tier.capacity > 0 ? Math.min(100, Math.round((tier.sold / tier.capacity) * 100)) : 0

  if (editing) {
    return (
      <li className="card p-6" style={{ borderColor: 'var(--color-accent)' }}>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px_140px] mb-6">
          <div className="field">
            <label htmlFor={`tier-${tier.id}-name`} className="label">Name</label>
            <input id={`tier-${tier.id}-name`} value={name} onChange={e => setName(e.target.value)} className="input" />
          </div>
          <div className="field">
            <label htmlFor={`tier-${tier.id}-price`} className="label">Price (LKR)</label>
            <NumberInput id={`tier-${tier.id}-price`} min={0} value={price} onChange={setPrice} className="input tabular-nums" />
          </div>
          <div className="field">
            <label htmlFor={`tier-${tier.id}-capacity`} className="label">Capacity</label>
            <NumberInput id={`tier-${tier.id}-capacity`} min={Math.max(1, tier.sold)} value={capacity} onChange={setCapacity} className="input tabular-nums" />
          </div>
        </div>
        {err && <p className="field-error mt-0 mb-4" role="alert">{err}</p>}
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
            {saving ? 'Saving…' : 'Save tier'}
          </button>
          <button
            onClick={() => { setName(tier.name); setPrice(tier.price); setCapacity(tier.capacity); setEditing(false); setErr('') }}
            className="btn btn-secondary btn-sm"
          >
            Cancel
          </button>
        </div>
      </li>
    )
  }

  return (
    <li className="card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
      <div className="min-w-0">
        <p className="h3">{tier.name}</p>
        <p className="meta">LKR {tier.price.toLocaleString()}</p>
        {err && <p className="field-error mt-1" role="alert">{err}</p>}
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right min-w-[96px]">
          <p className="tabular-nums font-medium">{tier.sold} / {tier.capacity}</p>
          <div className="meter mt-2">
            <span data-tone={pct >= 90 ? 'warn' : undefined} style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setEditing(true)} className="btn btn-secondary btn-sm">Edit</button>
          <button onClick={handleDelete} disabled={deleting || tier.sold > 0}
            title={tier.sold > 0 ? 'Cannot delete a tier with existing bookings' : undefined}
            className="btn btn-secondary btn-sm text-danger-text">
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </li>
  )
}
