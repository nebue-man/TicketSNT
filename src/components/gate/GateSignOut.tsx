'use client'

import { useRef } from 'react'
import { wipeGateLists, readGateState } from '@/lib/gate-offline/gate-store'

/**
 * Signs the Gate phone out. Wipes Gate lists (buyer names) and cached gate pages
 * first; Offline scans not yet uploaded stay on the phone (ADR-0004).
 */
export function GateSignOut({ eventId }: { eventId: string }) {
  const formRef = useRef<HTMLFormElement>(null)

  async function signOut() {
    const pending = readGateState(eventId).scans.length
    if (pending > 0 && !window.confirm(
      `${pending} offline scan${pending === 1 ? ' has' : 's have'} not been uploaded. ` +
      'They stay on this phone — sign in again and switch to online to upload them. Sign out anyway?',
    )) return

    try { wipeGateLists() } catch { /* storage blocked — nothing stored */ }
    try {
      navigator.serviceWorker?.controller?.postMessage('clear-gate-pages')
      await caches?.delete('gate-pages-v1')
    } catch { /* no service worker or cache */ }
    formRef.current?.submit()
  }

  return (
    <form ref={formRef} action="/api/auth/logout" method="POST" className="mt-10 pt-6 border-t border-line">
      <button
        type="button"
        onClick={() => void signOut()}
        className="navlink"
      >
        Sign out
      </button>
    </form>
  )
}
