'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { NumberInput } from '@/components/NumberInput'

interface Props {
  eventId: string
  existingSortOrder: number
}

export function AddTierForm({ eventId, existingSortOrder }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [price, setPrice] = useState(0)
  const [capacity, setCapacity] = useState(100)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch(`/api/admin/events/${eventId}/tiers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, capacity, sort_order: existingSortOrder }),
    })
    const json = await res.json() as { error?: string }
    if (!res.ok) { setError(json.error ?? 'Failed'); setSubmitting(false); return }

    setName('')
    setPrice(0)
    setCapacity(100)
    setSubmitting(false)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="field">
        <label htmlFor="tier-name" className="label">Tier name</label>
        <input id="tier-name" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. VIP, General Admission" className="input" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="field">
          <label htmlFor="tier-price" className="label">Price (LKR)</label>
          <NumberInput id="tier-price" min={0} value={price} onChange={setPrice} className="input tabular-nums" />
        </div>
        <div className="field">
          <label htmlFor="tier-capacity" className="label">Capacity</label>
          <NumberInput id="tier-capacity" min={1} value={capacity} onChange={setCapacity} className="input tabular-nums" />
        </div>
      </div>
      {error && <p className="field-error mt-0" role="alert">{error}</p>}
      <div>
        <button type="submit" disabled={submitting || !name.trim()} className="btn btn-primary">
          {submitting ? 'Adding…' : 'Add tier'}
        </button>
      </div>
    </form>
  )
}
