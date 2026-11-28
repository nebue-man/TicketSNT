'use client'

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import type { GateDoorCount, ScanResult } from '@/lib/data/gate'
import { createQrDecoder } from './qr-decoder'
import { unlockAudio, cueRead, cueAdmitted, cueProblem } from './gate-feedback'
import { useGateOffline } from './useGateOffline'
import { OfflinePanel } from './OfflinePanel'
import type { OfflineScanOutcome } from '@/lib/gate-offline/gate-list'

type AdmittedResult = Extract<ScanResult, { ok: true }>

/** What the gate screen shows after a Scan (see GLOSSARY.md: Scan outcome). */
type ScanOutcome =
  | { kind: 'admitted'; result: AdmittedResult; offline?: boolean } // Admitted, or Already scanned (Re-scan)
  | { kind: 'denied'; reservationId: string; message: string } // Not admitted, with reason
  | { kind: 'not_checked'; reservationId: string }             // network failure / timeout

/** The Door count shown with a Scan outcome (GLOSSARY.md: Door count). */
type ShownDoorCount =
  | { kind: 'live'; count: GateDoorCount }    // sent with this Scan's response
  | { kind: 'stale'; count: GateDoorCount }   // last one received; this Scan didn't reach the server
  | { kind: 'offline'; count: GateDoorCount } // approximate, from this phone's Gate list
  | { kind: 'unavailable' }
  | { kind: 'hidden' }                        // wrong PIN: no event numbers

type View =
  | { phase: 'scan' }
  | { phase: 'checking'; reservationId: string }
  | { phase: 'result'; outcome: ScanOutcome; doorCount: ShownDoorCount }

const SCAN_TIMEOUT_MS = 5000
const SAME_TICKET_GUARD_MS = 3000
const MUTE_KEY = 'snt-gate-muted'

const DENIED_MESSAGES: Record<string, string> = {
  invalid_pin: 'Incorrect gate PIN',
  not_found: 'Reservation not found',
  wrong_event: 'Ticket is for a different event',
  voided: 'This reservation has been voided',
}

// Sound on/off, remembered per device.
const muteListeners = new Set<() => void>()
function subscribeMute(listener: () => void) {
  muteListeners.add(listener)
  return () => { muteListeners.delete(listener) }
}
function isMuted() {
  return localStorage.getItem(MUTE_KEY) === '1'
}
function setMuted(muted: boolean) {
  localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  muteListeners.forEach(l => l())
}

/** Reads `doorCount` from a scan response: absent means hidden, null means unavailable. */
function toGateDoorCount(data: unknown): GateDoorCount | null | undefined {
  if (!data || typeof data !== 'object' || !('doorCount' in data)) return undefined
  const c = (data as { doorCount: unknown }).doorCount as Partial<GateDoorCount> | null
  return c && Number.isFinite(c.ticketsAdmitted) && Number.isFinite(c.ticketsSold)
    ? { ticketsAdmitted: c.ticketsAdmitted!, ticketsSold: c.ticketsSold! }
    : null
}

function outcomeReservationId(outcome: ScanOutcome): string {
  return outcome.kind === 'admitted' ? outcome.result.reservation.id : outcome.reservationId
}

/** An Offline scan shown on the same screens as an online one. */
function fromOfflineOutcome(o: OfflineScanOutcome): ScanOutcome {
  if (o.kind === 'denied') return { kind: 'denied', reservationId: o.reservationId, message: o.message }
  const reservation = { id: o.reservationId, buyer_name: o.entry.buyerName, buyer_email: '', buyer_phone: '', items: o.entry.items }
  return o.kind === 'admitted'
    ? { kind: 'admitted', offline: true, result: { ok: true, reservation, alreadyScanned: false } }
    : { kind: 'admitted', offline: true, result: { ok: true, reservation, alreadyScanned: true, scannedAt: o.admittedAt } }
}

export function GateScanner({ eventId, pin }: { eventId: string; pin: string }) {
  const [view, setView] = useState<View>({ phase: 'scan' })
  const [manualId, setManualId] = useState('')
  const [cameraError, setCameraError] = useState('')
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false)
  const offline = useGateOffline(eventId, pin)
  const offlineMode = offline.state.mode === 'offline'
  const { scanOffline, offlineCount } = offline

  const lastCountRef = useRef<GateDoorCount | null>(null) // last live Door count, for "Not checked"
  const videoRef = useRef<HTMLVideoElement>(null)
  const busyRef = useRef(false) // true while checking or showing a result: decoding is paused
  const ignoreRef = useRef<{ id: string; until: number } | null>(null)

  // The service worker lets this page open with no connection (ADR-0004).
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/gate-sw.js', { scope: '/gate/' }).catch(() => {})
  }, [])

  const check = useCallback(async (reservationId: string) => {
    if (busyRef.current) return
    busyRef.current = true
    videoRef.current?.pause() // freeze the frame; the camera stream stays on

    if (offlineMode) {
      const outcome = fromOfflineOutcome(scanOffline(reservationId))
      if (outcome.kind === 'admitted' && !outcome.result.alreadyScanned) cueAdmitted(isMuted())
      else cueProblem(isMuted())
      const count = offlineCount()
      setView({ phase: 'result', outcome, doorCount: count ? { kind: 'offline', count } : { kind: 'unavailable' } })
      return
    }

    setView({ phase: 'checking', reservationId })

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), SCAN_TIMEOUT_MS)
    let outcome: ScanOutcome
    let doorCount: ShownDoorCount
    try {
      const res = await fetch('/api/gate/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reservationId, eventId, gatePin: pin }),
        signal: ctrl.signal,
      })
      const data = await res.json()
      outcome = res.ok
        ? { kind: 'admitted', result: data as AdmittedResult }
        : { kind: 'denied', reservationId, message: DENIED_MESSAGES[data?.error] ?? 'Something went wrong' }
      const count = toGateDoorCount(data)
      if (count) lastCountRef.current = count
      doorCount = count ? { kind: 'live', count } : count === null ? { kind: 'unavailable' } : { kind: 'hidden' }
    } catch {
      outcome = { kind: 'not_checked', reservationId }
      const last = lastCountRef.current
      doorCount = last ? { kind: 'stale', count: last } : { kind: 'unavailable' }
    } finally {
      clearTimeout(timer)
    }

    if (outcome.kind === 'admitted' && !outcome.result.alreadyScanned) cueAdmitted(isMuted())
    else cueProblem(isMuted())
    setView({ phase: 'result', outcome, doorCount })
  }, [eventId, pin, offlineMode, scanOffline, offlineCount])

  const checkRef = useRef(check)
  useEffect(() => { checkRef.current = check }, [check])

  // Camera + decode loop. Runs once; the camera stays on for the whole session.
  useEffect(() => {
    let cancelled = false
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | undefined

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
      } catch {
        if (!cancelled) setCameraError('Camera unavailable — use manual entry below.')
        return
      }
      const video = videoRef.current
      if (cancelled || !video) { stream.getTracks().forEach(t => t.stop()); return }

      video.srcObject = stream
      await video.play().catch(() => {})
      const decoder = await createQrDecoder()

      const tick = async () => {
        if (cancelled) return
        if (!busyRef.current && video.readyState >= 2) {
          try {
            const text = await decoder.decode(video)
            if (text && !busyRef.current && !cancelled) {
              const id = text.trim().toUpperCase()
              const ignore = ignoreRef.current
              if (!(ignore && ignore.id === id && Date.now() < ignore.until)) {
                cueRead(isMuted())
                void checkRef.current(id)
              }
            }
          } catch { /* decoder hiccup — try the next frame */ }
        }
        timer = setTimeout(tick, decoder.intervalMs)
      }
      void tick()
    }

    void start()
    return () => {
      cancelled = true
      clearTimeout(timer)
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [])

  function scanNext() {
    unlockAudio()
    if (view.phase === 'result') {
      // The guest's QR is often still in view — don't re-read it straight away.
      ignoreRef.current = { id: outcomeReservationId(view.outcome), until: Date.now() + SAME_TICKET_GUARD_MS }
    }
    setManualId('')
    setView({ phase: 'scan' })
    busyRef.current = false
    void videoRef.current?.play().catch(() => {})
  }

  function retry(reservationId: string) {
    unlockAudio()
    busyRef.current = false
    void check(reservationId)
  }

  function submitManual() {
    const id = manualId.trim().toUpperCase()
    if (!id) return
    unlockAudio()
    void check(id)
  }

  function toggleMute() {
    unlockAudio()
    setMuted(!muted)
  }

  // From a "Not checked" screen: switch this phone to offline mode, then scan again.
  async function goOfflineAndScan() {
    await offline.goOffline()
    setManualId('')
    setView({ phase: 'scan' })
    busyRef.current = false
    void videoRef.current?.play().catch(() => {})
  }

  const checkingId = view.phase === 'checking' ? view.reservationId : null

  return (
    <div onPointerDown={unlockAudio}>
      <OfflinePanel offline={offline} />

      {/* ── Scan screen (always mounted so the camera keeps running) ───────── */}
      <div className="flex items-center justify-between gap-4 mb-3">
        <h2 className="h2">Scan a ticket</h2>
        <button
          type="button"
          onClick={toggleMute}
          aria-pressed={!muted}
          className="btn btn-secondary btn-sm h-11"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.5 6h2l3-2.5v9l-3-2.5h-2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            {muted
              ? <path d="m11 6 3 4m0-4-3 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              : <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5M12.5 3.5a6.5 6.5 0 0 1 0 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}
          </svg>
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>

      <div className="relative mb-6 overflow-hidden rounded-lg bg-surface aspect-square">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        {/* Corner guides mark the area that is decoded */}
        {['top-[15%] left-[15%]', 'top-[15%] right-[15%]', 'bottom-[15%] left-[15%]', 'bottom-[15%] right-[15%]'].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-7 h-7`} style={{
            borderColor: 'var(--color-accent)',
            borderTopWidth: i < 2 ? '3px' : 0,
            borderBottomWidth: i >= 2 ? '3px' : 0,
            borderLeftWidth: i % 2 === 0 ? '3px' : 0,
            borderRightWidth: i % 2 === 1 ? '3px' : 0,
            borderTopLeftRadius: i === 0 ? '8px' : 0,
            borderTopRightRadius: i === 1 ? '8px' : 0,
            borderBottomLeftRadius: i === 2 ? '8px' : 0,
            borderBottomRightRadius: i === 3 ? '8px' : 0,
          }} />
        ))}
        {checkingId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-black/70" role="status">
            <p className="text-accent font-medium mb-2">Checking…</p>
            <p className="mono text-[22px]">{checkingId}</p>
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="meta">{cameraError}</p>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="manual-id" className="label">Or type the reservation ID</label>
        <div className="flex gap-2">
          <input
            id="manual-id"
            type="text"
            value={manualId}
            onChange={e => setManualId(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') submitManual() }}
            placeholder="RES-XXXXXX"
            autoCapitalize="characters"
            autoComplete="off"
            className="input mono flex-1 min-w-0 text-[18px] tracking-[0.08em]"
          />
          <button
            onClick={submitManual}
            disabled={!manualId.trim() || view.phase !== 'scan'}
            className="btn btn-primary shrink-0 h-12"
          >
            Check ID
          </button>
        </div>
      </div>

      {/* ── Full-screen Scan outcome ─────────────────────────────────────────── */}
      {view.phase === 'result' && (
        <OutcomeScreen
          outcome={view.outcome}
          doorCount={view.doorCount}
          onScanNext={scanNext}
          onRetry={retry}
          onGoOffline={offline.state.list ? goOfflineAndScan : undefined}
          goingOffline={offline.action === 'go_offline'}
        />
      )}
    </div>
  )
}

function OutcomeScreen({ outcome, doorCount, onScanNext, onRetry, onGoOffline, goingOffline }: {
  outcome: ScanOutcome
  doorCount: ShownDoorCount
  onScanNext: () => void
  onRetry: (reservationId: string) => void
  onGoOffline?: () => void
  goingOffline?: boolean
}) {
  let bg: string, fg: string, label: string, headline: string, sub: string
  let icon: 'tick' | 'repeat' | 'cross'
  let items: AdmittedResult['reservation']['items'] = []

  if (outcome.kind === 'admitted') {
    const { result } = outcome
    items = result.reservation.items
    headline = result.reservation.buyer_name
    sub = result.reservation.id
    if (result.alreadyScanned) {
      const at = new Date(result.scannedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })
      bg = 'var(--color-warn)'; fg = '#0f0f0f'; label = `Already scanned · ${at}`; icon = 'repeat'
    } else {
      bg = 'var(--color-ok)'; fg = '#0f0f0f'; label = 'Admitted'; icon = 'tick'
    }
    if (outcome.offline) label += ' · offline'
  } else if (outcome.kind === 'denied') {
    bg = 'var(--color-danger)'; fg = '#ffffff'; label = 'Not admitted'; icon = 'cross'
    headline = outcome.message; sub = outcome.reservationId
  } else {
    bg = 'var(--color-danger)'; fg = '#ffffff'; label = 'Not checked'; icon = 'cross'
    headline = 'No connection. The ticket was not checked.'; sub = outcome.reservationId
  }

  const retryId = outcome.kind === 'not_checked' ? outcome.reservationId : null
  // Buttons on the coloured ground: filled in the ink colour, or outlined in it.
  const filled = { background: fg, color: bg }
  const outlined = { background: 'transparent', color: fg, boxShadow: `inset 0 0 0 2px ${fg}` }

  return (
    <div className="fixed inset-0 z-50 flex flex-col px-6 pt-10 pb-[max(24px,env(safe-area-inset-bottom))] animate-fade-in"
      style={{ background: bg, color: fg }} role="alertdialog" aria-labelledby="outcome-label" aria-describedby="outcome-headline">
      <div className="flex-1 overflow-y-auto max-w-[480px] w-full mx-auto">
        <OutcomeIcon kind={icon} />
        <p id="outcome-label" className="font-medium mt-6 mb-2 text-[20px]">{label}</p>
        <h2 id="outcome-headline" className="font-medium mb-2 text-[36px] leading-[1.1] tracking-[-0.025em] text-balance">{headline}</h2>
        <p className="mono mb-8 text-[16px]" style={{ opacity: 0.7 }}>{sub}</p>
        {items.map((item, i) => (
          <div key={i} className="flex justify-between py-3 text-[22px]" style={{ borderBottom: `1px solid color-mix(in srgb, ${fg} 18%, transparent)` }}>
            <span>{item.ticket_type_name}</span>
            <span className="font-medium tabular-nums">× {item.quantity}</span>
          </div>
        ))}
      </div>

      <div className="max-w-[480px] w-full mx-auto flex flex-col gap-3 pt-6">
        <DoorCountSection doorCount={doorCount} fg={fg} />
        {retryId && (
          <button onClick={() => onRetry(retryId)} className="btn btn-lg btn-block" style={filled}>
            Retry
          </button>
        )}
        {retryId && onGoOffline && (
          <button onClick={onGoOffline} disabled={goingOffline} className="btn btn-lg btn-block" style={outlined}>
            {goingOffline ? 'Switching…' : 'Switch to offline mode'}
          </button>
        )}
        <button onClick={onScanNext} className="btn btn-lg btn-block" autoFocus
          style={outcome.kind === 'not_checked' ? outlined : filled}>
          Scan next
        </button>
      </div>
    </div>
  )
}

/** The Door count, pinned above the buttons on every Scan outcome, in the screen's ink colour. */
function DoorCountSection({ doorCount, fg }: { doorCount: ShownDoorCount; fg: string }) {
  if (doorCount.kind === 'hidden') return null
  const rule = `color-mix(in srgb, ${fg} 18%, transparent)`

  if (doorCount.kind === 'unavailable') {
    return (
      <section aria-label="Door count" className="pt-4 pb-1 text-[16px]" style={{ borderTop: `1px solid ${rule}` }}>
        <span style={{ opacity: 0.7 }}>Door count unavailable</span>
      </section>
    )
  }

  const { ticketsAdmitted, ticketsSold } = doorCount.count
  const pct = ticketsSold > 0 ? Math.min(100, (ticketsAdmitted / ticketsSold) * 100) : 0
  const note = doorCount.kind === 'offline' ? 'offline, this phone only'
    : doorCount.kind === 'stale' ? 'not updated' : null

  return (
    <section aria-label="Door count" className="pt-4 pb-1" style={{ borderTop: `1px solid ${rule}` }}>
      <div className="flex justify-between items-baseline gap-4 mb-2">
        <span className="text-[14px] font-medium uppercase tracking-[0.08em]" style={{ opacity: 0.7 }}>Door count</span>
        {note && <span className="text-[14px]" style={{ opacity: 0.7 }}>{note}</span>}
      </div>
      <p className="tabular-nums text-[28px] font-medium leading-[1.1] tracking-[-0.02em] mb-3">
        {doorCount.kind === 'offline' && '≈ '}{ticketsAdmitted.toLocaleString()}
        <span className="text-[18px]" style={{ opacity: 0.7 }}> / {ticketsSold.toLocaleString()} admitted</span>
      </p>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: rule }} role="presentation">
        <div className="h-full origin-left" style={{ background: fg, transform: `scaleX(${pct / 100})` }} />
      </div>
    </section>
  )
}

function OutcomeIcon({ kind }: { kind: 'tick' | 'repeat' | 'cross' }) {
  return (
    <svg className="animate-scale-in" width="72" height="72" viewBox="0 0 72 72" fill="none" aria-hidden="true">
      <circle cx="36" cy="36" r="34" stroke="currentColor" strokeWidth="3" />
      {kind === 'tick' && <path d="m22 37 9 9 19-20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      {kind === 'cross' && <path d="m25 25 22 22m0-22L25 47" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />}
      {kind === 'repeat' && <path d="M36 21v16l10 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  )
}
