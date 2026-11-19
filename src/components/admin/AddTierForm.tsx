'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

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

  const inputClass = "w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]"

  return (
    <form onSubmit={handleSubmit} className="max-w-[500px]">
      <div className="mb-6">
        <label className="block text-ash-gray font-semibold uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Tier name
        </label>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. VIP, General Admission" className={inputClass} style={{ fontSize: '17px' }} />
      </div>
      <div className="flex gap-6 mb-6">
        <div className="flex-1">
          <label className="block text-ash-gray font-semibold uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
            Price (LKR)
          </label>
          <input type="number" min={0} value={price}
            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0) setPrice(v) }}
            className={inputClass} style={{ fontSize: '17px' }} />
        </div>
        <div className="flex-1">
          <label className="block text-ash-gray font-semibold uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
            Capacity
          </label>
          <input type="number" min={1} value={capacity}
            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setCapacity(v) }}
            className={inputClass} style={{ fontSize: '17px' }} />
        </div>
      </div>
      {error && <p className="text-saffron-spark mb-6" style={{ fontSize: '14px' }}>{error}</p>}
      <button type="submit" disabled={submitting || !name.trim()}
        className="inline-flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase disabled:opacity-40 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
        style={{ fontSize: '13px', letterSpacing: '0.025em', borderRadius: '24px', padding: '12px 28px' }}>
        {submitting ? 'Adding…' : 'Add tier'}
      </button>
    </form>
  )
}
