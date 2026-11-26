'use client'

import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import type { ScanResult } from '@/lib/data/gate'
import { createQrDecoder } from './qr-decoder'
import { unlockAudio, cueRead, cueAdmitted, cueProblem } from './gate-feedback'

type AdmittedResult = Extract<ScanResult, { ok: true }>

/** What the gate screen shows after a Scan (see GLOSSARY.md: Scan outcome). */
type ScanOutcome =
  | { kind: 'admitted'; result: AdmittedResult }              // Admitted, or Already scanned (Re-scan)
  | { kind: 'denied'; reservationId: string; message: string } // Not admitted, with reason
  | { kind: 'not_checked'; reservationId: string }             // network failure / timeout

type View =
  | { phase: 'scan' }
  | { phase: 'checking'; reservationId: string }
  | { phase: 'result'; outcome: ScanOutcome }

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

function outcomeReservationId(outcome: ScanOutcome): string {
  return outcome.kind === 'admitted' ? outcome.result.reservation.id : outcome.reservationId
}

export function GateScanner({ eventId, pin }: { eventId: string; pin: string }) {
  const [view, setView] = useState<View>({ phase: 'scan' })
  const [manualId, setManualId] = useState('')
  const [cameraError, setCameraError] = useState('')
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const busyRef = useRef(false) // true while checking or showing a result: decoding is paused
  const ignoreRef = useRef<{ id: string; until: number } | null>(null)

  const check = useCallback(async (reservationId: string) => {
    if (busyRef.current) return
    busyRef.current = true
    videoRef.current?.pause() // freeze the frame; the camera stream stays on
    setView({ phase: 'checking', reservationId })

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), SCAN_TIMEOUT_MS)
    let outcome: ScanOutcome
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
    } catch {
      outcome = { kind: 'not_checked', reservationId }
    } finally {
      clearTimeout(timer)
    }

    if (outcome.kind === 'admitted' && !outcome.result.alreadyScanned) cueAdmitted(isMuted())
    else cueProblem(isMuted())
    setView({ phase: 'result', outcome })
  }, [eventId, pin])

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

  const checkingId = view.phase === 'checking' ? view.reservationId : null

  return (
    <div onPointerDown={unlockAudio}>
      {/* ── Scan screen (always mounted so the camera keeps running) ───────── */}
      <div className="flex items-center justify-between mb-6">
        <p className="text-ash-gray font-semibold uppercase" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
          Scan ticket QR
        </p>
        <button
          type="button"
          onClick={toggleMute}
          className="text-ash-gray font-semibold uppercase hover:text-bone-white transition-colors"
          style={{ fontSize: '12px', letterSpacing: '0.35px' }}
        >
          {muted ? 'Sound off' : 'Sound on'}
        </button>
      </div>

      <div className="relative mb-6 overflow-hidden" style={{ borderRadius: '16px', aspectRatio: '1', background: '#0a0a0a' }}>
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        {/* Corner guides mark the area that is decoded */}
        {['top-[15%] left-[15%]', 'top-[15%] right-[15%]', 'bottom-[15%] left-[15%]', 'bottom-[15%] right-[15%]'].map((pos, i) => (
          <div key={i} className={`absolute ${pos} w-6 h-6`} style={{ borderColor: '#b9ff4b',
            borderTopWidth: i < 2 ? '2px' : 0,
            borderBottomWidth: i >= 2 ? '2px' : 0,
            borderLeftWidth: i % 2 === 0 ? '2px' : 0,
            borderRightWidth: i % 2 === 1 ? '2px' : 0,
          }} />
        ))}
        {checkingId && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6" style={{ background: 'rgba(0,0,0,0.6)' }}>
            <p className="text-lime-spark font-semibold uppercase mb-2" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
              Checking…
            </p>
            <p className="text-bone-white font-light tracking-widest" style={{ fontSize: '20px' }}>{checkingId}</p>
          </div>
        )}
        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <p className="text-ash-gray font-light" style={{ fontSize: '14px' }}>{cameraError}</p>
          </div>
        )}
      </div>

      <p className="text-ash-gray uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
        Or enter ID manually
      </p>
      <div className="flex gap-3">
        <input
          type="text"
          value={manualId}
          onChange={e => setManualId(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter') submitManual() }}
          placeholder="RES-XXXXXX"
          className="flex-1 bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors tracking-widest"
          style={{ fontSize: '18px' }}
        />
        <button
          onClick={submitManual}
          disabled={!manualId.trim() || view.phase !== 'scan'}
          className="text-electric-iris font-semibold uppercase disabled:opacity-30 active:scale-95 transition-transform duration-100 ease-out"
          style={{ fontSize: '14px', letterSpacing: '0.025em' }}
        >
          Check
        </button>
      </div>

      {/* ── Full-screen Scan outcome ─────────────────────────────────────────── */}
      {view.phase === 'result' && (
        <OutcomeScreen outcome={view.outcome} onScanNext={scanNext} onRetry={retry} />
      )}
    </div>
  )
}

function OutcomeScreen({ outcome, onScanNext, onRetry }: {
  outcome: ScanOutcome
  onScanNext: () => void
  onRetry: (reservationId: string) => void
}) {
  let bg: string, fg: string, label: string, headline: string, sub: string
  let items: AdmittedResult['reservation']['items'] = []

  if (outcome.kind === 'admitted') {
    const { result } = outcome
    items = result.reservation.items
    headline = result.reservation.buyer_name
    sub = result.reservation.id
    if (result.alreadyScanned) {
      const at = new Date(result.scannedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })
      bg = '#ffb829'; fg = '#000000'; label = `Already scanned · ${at}`
    } else {
      bg = '#b9ff4b'; fg = '#000000'; label = 'Admitted'
    }
  } else if (outcome.kind === 'denied') {
    bg = '#e5383b'; fg = '#ffffff'; label = 'Not admitted'
    headline = outcome.message; sub = outcome.reservationId
  } else {
    bg = '#e5383b'; fg = '#ffffff'; label = 'Not checked'
    headline = 'No connection — ticket was not checked'; sub = outcome.reservationId
  }

  const retryId = outcome.kind === 'not_checked' ? outcome.reservationId : null
  const buttonStyle = { fontSize: '16px', letterSpacing: '0.025em', borderRadius: '28px', padding: '18px 32px' }

  return (
    <div className="fixed inset-0 z-50 flex flex-col px-6 py-10 animate-fade-in-up" style={{ background: bg, color: fg }}>
      <div className="flex-1 overflow-y-auto max-w-[480px] w-full mx-auto">
        <p className="font-semibold uppercase mb-4" style={{ fontSize: '18px', letterSpacing: '0.35px' }}>{label}</p>
        <h2 className="font-normal mb-2" style={{ fontSize: '34px', lineHeight: 1.15, letterSpacing: '-0.02em' }}>{headline}</h2>
        <p className="font-light mb-8 tracking-widest" style={{ fontSize: '16px', opacity: 0.75 }}>{sub}</p>
        {items.map((item, i) => (
          <div key={i} className="flex justify-between py-3" style={{ borderBottom: `1px solid ${fg}22`, fontSize: '22px' }}>
            <span className="font-light">{item.ticket_type_name}</span>
            <span className="font-semibold">×{item.quantity}</span>
          </div>
        ))}
      </div>

      <div className="max-w-[480px] w-full mx-auto flex flex-col gap-3 pt-6">
        {retryId && (
          <button
            onClick={() => onRetry(retryId)}
            className="w-full font-semibold uppercase active:scale-[0.97] transition-transform duration-100 ease-out"
            style={{ ...buttonStyle, background: fg, color: bg }}
          >
            Retry
          </button>
        )}
        <button
          onClick={onScanNext}
          className="w-full font-semibold uppercase active:scale-[0.97] transition-transform duration-100 ease-out"
          style={{ ...buttonStyle, background: outcome.kind === 'not_checked' ? 'transparent' : fg, color: outcome.kind === 'not_checked' ? fg : bg, border: `2px solid ${fg}` }}
        >
          Scan next
        </button>
      </div>
    </div>
  )
}
