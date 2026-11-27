'use client'

import { useEffect, useState } from 'react'
import { countTickets } from '@/lib/gate-offline/gate-list'
import type { useGateOffline } from './useGateOffline'

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })
}

function ageOf(iso: string, now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60_000))
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min old`
  const h = Math.floor(min / 60)
  return `${h} h ${min % 60} min old`
}

/** Gate list download and the manual online/offline switch (ADR-0004). */
export function OfflinePanel({ offline }: { offline: ReturnType<typeof useGateOffline> }) {
  const { state, phone, action, message } = offline
  const [now, setNow] = useState(() => Date.now())
  const [nameDraft, setNameDraft] = useState('')

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(t)
  }, [])

  const busy = action !== null
  const isOffline = state.mode === 'offline'
  const pending = state.scans.length
  const listLine = state.list && state.listDownloadedAt
    ? `Gate list from ${timeOf(state.listDownloadedAt)} (${ageOf(state.listDownloadedAt, now)}) · ${countTickets(state.list).toLocaleString()} tickets`
    : 'No gate list on this phone'

  return (
    <div className="mb-8">
      {!phone && (
        <div className="card p-4 mb-3">
          <div className="field">
            <label htmlFor="phone-name" className="label">Name this phone for offline mode</label>
            <div className="flex gap-2">
              <input
                id="phone-name"
                type="text"
                value={nameDraft}
                maxLength={40}
                onChange={e => setNameDraft(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') offline.nameThisPhone(nameDraft) }}
                placeholder="e.g. Gate A"
                className="input flex-1 min-w-0"
              />
              <button
                onClick={() => offline.nameThisPhone(nameDraft)}
                disabled={!nameDraft.trim()}
                className="btn btn-secondary shrink-0 h-12"
              >
                Save name
              </button>
            </div>
          </div>
        </div>
      )}

      {isOffline ? (
        <div className="p-4 rounded-md bg-warn text-[#0f0f0f]" role="status">
          <p className="font-medium mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0f0f0f]" aria-hidden="true" />
            Offline mode
          </p>
          <p className="text-[14px] mb-1">{listLine}</p>
          <p className="text-[14px] mb-4">
            {pending} scan{pending === 1 ? '' : 's'} waiting to upload. Other gates can&apos;t see these until you switch back online.
          </p>
          <button
            onClick={() => void offline.goOnline()}
            disabled={busy}
            className="btn btn-block h-12 bg-[#0f0f0f] text-warn"
          >
            {action === 'go_online' ? 'Uploading…' : pending ? `Switch to online · upload ${pending}` : 'Switch to online'}
          </button>
        </div>
      ) : (
        <div className="card p-4">
          <p className="font-medium mb-1 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent" aria-hidden="true" />
            Online
          </p>
          <p className="meta mb-4">{listLine}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void offline.download()}
              disabled={busy}
              className="btn btn-secondary h-12 px-3 text-[15px]"
            >
              {action === 'download' ? 'Downloading…' : state.list ? 'Update gate list' : 'Download gate list'}
            </button>
            <button
              onClick={() => void offline.goOffline()}
              disabled={busy || !state.list || !phone}
              className="btn h-12 px-3 text-[15px] bg-warn text-[#0f0f0f]"
            >
              {action === 'go_offline' ? 'Switching…' : 'Switch to offline'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className={`text-[14px] mt-3 ${message.tone === 'ok' ? 'text-accent' : 'text-warn'}`} role="status">
          {message.text}
        </p>
      )}
    </div>
  )
}
