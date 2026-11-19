'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { TicketType } from '@/types/database'

interface Props {
  tiers: TicketType[]
  eventId: string
}

export function TiersList({ tiers, eventId }: Props) {
  const router = useRouter()

  if (tiers.length === 0) {
    return <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>No tiers yet.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {tiers.map(tier => (
        <TierRow key={tier.id} tier={tier} eventId={eventId} onRefresh={() => router.refresh()} />
      ))}
    </div>
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

  const inputClass = "bg-transparent border-b border-[#333] text-bone-white font-light pb-2 outline-none focus:border-electric-iris transition-colors"

  if (editing) {
    return (
      <div className="p-5 border border-electric-iris" style={{ borderRadius: '12px' }}>
        <div className="flex gap-4 mb-4 flex-wrap">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-ash-gray font-semibold uppercase mb-2" style={{ fontSize: '11px', letterSpacing: '0.35px' }}>Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className={inputClass} style={{ fontSize: '15px', width: '100%' }} />
          </div>
          <div className="w-32">
            <label className="block text-ash-gray font-semibold uppercase mb-2" style={{ fontSize: '11px', letterSpacing: '0.35px' }}>Price (LKR)</label>
            <input type="number" min={0} value={price} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 0) setPrice(v) }} className={inputClass} style={{ fontSize: '15px', width: '100%' }} />
          </div>
          <div className="w-32">
            <label className="block text-ash-gray font-semibold uppercase mb-2" style={{ fontSize: '11px', letterSpacing: '0.35px' }}>Capacity</label>
            <input type="number" min={tier.sold} value={capacity} onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v) && v >= 1) setCapacity(v) }} className={inputClass} style={{ fontSize: '15px', width: '100%' }} />
          </div>
        </div>
        {err && <p className="text-saffron-spark mb-3" style={{ fontSize: '12px' }}>{err}</p>}
        <div className="flex gap-4">
          <button onClick={handleSave} disabled={saving}
            className="text-electric-iris font-semibold disabled:opacity-40 hover:opacity-80 transition-opacity"
            style={{ fontSize: '13px' }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button onClick={() => { setName(tier.name); setPrice(tier.price); setCapacity(tier.capacity); setEditing(false); setErr('') }}
            className="text-ash-gray hover:text-bone-white transition-colors font-light"
            style={{ fontSize: '13px' }}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between p-5 border border-[#1a1a1a]" style={{ borderRadius: '12px' }}>
      <div>
        <p className="text-bone-white font-normal" style={{ fontSize: '16px' }}>{tier.name}</p>
        <p className="text-saffron-spark font-semibold mt-0.5" style={{ fontSize: '13px' }}>
          LKR {tier.price.toLocaleString()}
        </p>
        {err && <p className="text-saffron-spark mt-1" style={{ fontSize: '12px' }}>{err}</p>}
      </div>
      <div className="flex items-center gap-6">
        <div className="text-right">
          <p className="text-bone-white font-semibold tabular-nums" style={{ fontSize: '15px' }}>
            {tier.sold} / {tier.capacity}
          </p>
          <p className="text-ash-gray font-light" style={{ fontSize: '12px' }}>sold / cap</p>
        </div>
        <button onClick={() => setEditing(true)}
          className="text-electric-iris hover:opacity-80 transition-opacity font-light"
          style={{ fontSize: '13px' }}>
          Edit
        </button>
        <button onClick={handleDelete} disabled={deleting || tier.sold > 0}
          title={tier.sold > 0 ? 'Cannot delete a tier with existing bookings' : undefined}
          className="text-ash-gray hover:text-saffron-spark disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-light"
          style={{ fontSize: '13px' }}>
          {deleting ? 'Deleting…' : 'Delete'}
        </button>
      </div>
    </div>
  )
}
