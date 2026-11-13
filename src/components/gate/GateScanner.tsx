'use client'

import { useState, useEffect, useRef } from 'react'
import type { ScanResult } from '@/lib/data/gate'

type Phase = 'scan' | 'result'

interface ScanState {
  result: Extract<ScanResult, { ok: true }> | null
  error: string
}

export function GateScanner({ eventId, pin }: { eventId: string; pin: string }) {
  const [phase, setPhase] = useState<Phase>('scan')
  const [manualId, setManualId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [scanState, setScanState] = useState<ScanState>({ result: null, error: '' })
  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<{ stop: () => void } | null>(null)

  // Start ZXing camera scanner once in scan phase
  useEffect(() => {
    if (phase !== 'scan') return

    let stopped = false

    async function startCamera() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const videoEl = videoRef.current
        if (!videoEl) return

        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoEl,
          (result, err) => {
            if (stopped) return
            if (result) {
              const id = result.getText().trim().toUpperCase()
              handleScan(id)
            }
            void err // decode errors are normal between frames
          }
        )
        scannerRef.current = controls
      } catch {
        setCameraError('Camera unavailable — use manual entry below.')
      }
    }

    startCamera()

    return () => {
      stopped = true
      scannerRef.current?.stop()
      scannerRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  async function handleScan(reservationId: string) {
    if (scanning) return
    setScanning(true)
    scannerRef.current?.stop()

    const res = await fetch('/api/gate/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservationId, eventId, gatePin: pin }),
    })
    const data = await res.json()

    if (!res.ok) {
      setScanState({
        result: null,
        error: data.error === 'invalid_pin' ? 'Incorrect PIN'
          : data.error === 'not_found' ? 'Reservation not found'
          : data.error === 'wrong_event' ? 'Ticket is for a different event'
          : data.error === 'voided' ? 'This reservation has been voided'
          : 'Something went wrong',
      })
    } else {
      setScanState({ result: data, error: '' })
    }

    setScanning(false)
    setPhase('result')
  }

  function resetToScan() {
    setScanState({ result: null, error: '' })
    setManualId('')
    setPhase('scan')
  }

  // ── Scan screen ─────────────────────────────────────────────────────────────
  if (phase === 'scan') {
    return (
      <div>
        <p className="text-ash-gray font-semibold uppercase mb-6" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
          Scan ticket QR
        </p>

        {/* Camera viewfinder */}
        <div className="relative mb-6 overflow-hidden" style={{ borderRadius: '16px', aspectRatio: '1', background: '#0a0a0a' }}>
          <video ref={videoRef} className="w-full h-full object-cover" />
          {/* Corner guides */}
          {['top-3 left-3', 'top-3 right-3', 'bottom-3 left-3', 'bottom-3 right-3'].map((pos, i) => (
            <div key={i} className={`absolute ${pos} w-6 h-6`} style={{ borderColor: '#b9ff4b',
              borderTopWidth: i < 2 ? '2px' : 0,
              borderBottomWidth: i >= 2 ? '2px' : 0,
              borderLeftWidth: i % 2 === 0 ? '2px' : 0,
              borderRightWidth: i % 2 === 1 ? '2px' : 0,
            }} />
          ))}
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <p className="text-ash-gray font-light" style={{ fontSize: '14px' }}>{cameraError}</p>
            </div>
          )}
        </div>

        {/* Manual entry */}
        <p className="text-ash-gray uppercase mb-3" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Or enter ID manually
        </p>
        <div className="flex gap-3">
          <input
            type="text"
            value={manualId}
            onChange={e => setManualId(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter' && manualId.trim()) handleScan(manualId.trim()) }}
            placeholder="RES-XXXXXX"
            className="flex-1 bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors tracking-widest"
            style={{ fontSize: '18px' }}
          />
          <button
            onClick={() => { if (manualId.trim()) handleScan(manualId.trim()) }}
            disabled={!manualId.trim() || scanning}
            className="text-electric-iris font-semibold uppercase disabled:opacity-30"
            style={{ fontSize: '14px', letterSpacing: '0.025em' }}
          >
            Check
          </button>
        </div>
      </div>
    )
  }

  // ── Result screen ────────────────────────────────────────────────────────────
  const { result, error } = scanState

  if (error || !result) {
    return (
      <div>
        <p className="text-saffron-spark font-semibold uppercase mb-4" style={{ fontSize: '14px', letterSpacing: '0.35px' }}>
          Not admitted
        </p>
        <p className="text-bone-white font-normal mb-8" style={{ fontSize: '24px' }}>{error}</p>
        <button onClick={resetToScan} className="inline-flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase hover:opacity-90 transition-opacity"
          style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', padding: '14px 32px' }}>
          Scan next
        </button>
      </div>
    )
  }

  const { reservation, alreadyScanned } = result
  const scannedAt = alreadyScanned ? new Date((result as { scannedAt: string }).scannedAt).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' }) : null

  return (
    <div>
      <p
        className="font-semibold uppercase mb-4"
        style={{
          fontSize: '14px', letterSpacing: '0.35px',
          color: alreadyScanned ? '#ffb829' : '#b9ff4b',
        }}
      >
        {alreadyScanned ? `Already scanned · ${scannedAt}` : 'Admitted'}
      </p>

      <h2 className="text-bone-white font-normal mb-1" style={{ fontSize: '27px', lineHeight: 1.2 }}>
        {reservation.buyer_name}
      </h2>
      <p className="text-ash-gray font-light mb-6" style={{ fontSize: '15px' }}>
        {reservation.id}
      </p>

      <div className="mb-8">
        {reservation.items.map((item, i) => (
          <div key={i} className="flex justify-between py-3 border-b border-[#1a1a1a] last:border-0">
            <span className="text-bone-white font-light" style={{ fontSize: '15px' }}>{item.ticket_type_name}</span>
            <span className="text-saffron-spark font-semibold" style={{ fontSize: '15px' }}>×{item.quantity}</span>
          </div>
        ))}
      </div>

      <button onClick={resetToScan} className="inline-flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase hover:opacity-90 transition-opacity"
        style={{ fontSize: '14px', letterSpacing: '0.025em', borderRadius: '24px', padding: '14px 32px' }}>
        Scan next
      </button>
    </div>
  )
}
