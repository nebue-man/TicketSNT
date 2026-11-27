'use client'

import { useEffect, useState } from 'react'
import { countTickets } from '@/lib/gate-offline/gate-list'
import type { useGateOffline } from './useGateOffline'

const AMBER = '#ffb829'

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

  const smallButton = 'font-semibold uppercase disabled:opacity-40 active:scale-[0.97] transition-transform duration-100 ease-out'
  const smallStyle = { fontSize: '12px', letterSpacing: '0.35px', borderRadius: '20px', padding: '10px 16px' }

  return (
    <div className="mb-6">
      {!phone && (
        <div className="mb-4 p-4" style={{ border: '1px solid #2a2a2a', borderRadius: '16px' }}>
          <p className="text-ash-gray uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
            Name this phone for offline mode
          </p>
          <div className="flex gap-3">
            <input
              type="text"
              value={nameDraft}
              maxLength={40}
              onChange={e => setNameDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') offline.nameThisPhone(nameDraft) }}
              placeholder="e.g. Gate A"
              className="flex-1 bg-transparent border-b border-[#333] text-bone-white font-light pb-2 outline-none focus:border-electric-iris"
              style={{ fontSize: '16px' }}
            />
            <button
              onClick={() => offline.nameThisPhone(nameDraft)}
              disabled={!nameDraft.trim()}
              className={`text-electric-iris ${smallButton}`}
              style={{ fontSize: '14px' }}
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isOffline ? (
        <div className="p-4" style={{ background: AMBER, color: '#000', borderRadius: '16px' }} role="status">
          <p className="font-semibold uppercase mb-1" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
            Offline mode
          </p>
          <p className="font-light mb-1" style={{ fontSize: '14px' }}>{listLine}</p>
          <p className="font-light mb-3" style={{ fontSize: '14px' }}>
            {pending} scan{pending === 1 ? '' : 's'} waiting to upload. Other gates can&apos;t see these until you switch back online.
          </p>
          <button
            onClick={() => void offline.goOnline()}
            disabled={busy}
            className={smallButton}
            style={{ ...smallStyle, background: '#000', color: AMBER }}
          >
            {action === 'go_online' ? 'Uploading…' : pending ? `Switch to online · upload ${pending}` : 'Switch to online'}
          </button>
        </div>
      ) : (
        <div className="p-4" style={{ border: '1px solid #2a2a2a', borderRadius: '16px' }}>
          <p className="text-ash-gray font-light mb-3" style={{ fontSize: '14px' }}>
            <span className="text-lime-spark font-semibold uppercase" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>Online</span>
            {' · '}{listLine}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void offline.download()}
              disabled={busy}
              className={`text-bone-white ${smallButton}`}
              style={{ ...smallStyle, border: '1px solid #333' }}
            >
              {action === 'download' ? 'Downloading…' : state.list ? 'Update gate list' : 'Download gate list'}
            </button>
            <button
              onClick={() => void offline.goOffline()}
              disabled={busy || !state.list || !phone}
              className={smallButton}
              style={{ ...smallStyle, background: AMBER, color: '#000' }}
            >
              {action === 'go_offline' ? 'Switching…' : 'Switch to offline'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="font-light mt-3" style={{ fontSize: '14px', color: message.tone === 'ok' ? '#b9ff4b' : AMBER }}>
          {message.text}
        </p>
      )}
    </div>
  )
}
