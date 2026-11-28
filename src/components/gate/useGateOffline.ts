'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { decideOfflineScan, offlineDoorCount, toGateList, type GateList, type OfflineScanOutcome } from '@/lib/gate-offline/gate-list'
import type { GateDoorCount } from '@/lib/data/gate'
import {
  readGateState, writeGateState, readGatePhone, saveGatePhoneName, gatePhoneLabel,
  EMPTY_GATE_STATE, type GateState, type GatePhone,
} from '@/lib/gate-offline/gate-store'

// Timeouts: a quick list update when switching to offline (the network is
// probably failing — don't keep staff waiting), longer for a deliberate download
// or upload of a few thousand rows.
const QUICK_UPDATE_MS = 4000
const DOWNLOAD_MS = 20000
const UPLOAD_MS = 20000

export interface UploadSummary {
  recorded: number
  doubleEntries: number
  voided: number
  rejected: number
}

export type OfflineAction = 'download' | 'go_offline' | 'go_online' | null

async function postJson(url: string, body: unknown, timeoutMs: number): Promise<{ ok: boolean; status: number; data: unknown }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
      cache: 'no-store',
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } finally {
    clearTimeout(timer)
  }
}

/** Offline gate mode state and actions for one event (ADR-0004). */
export function useGateOffline(eventId: string, pin: string) {
  const [state, setState] = useState<GateState>(EMPTY_GATE_STATE)
  const [phone, setPhone] = useState<GatePhone | null>(null)
  const [action, setAction] = useState<OfflineAction>(null)
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string } | null>(null)
  const stateRef = useRef(state)

  const commit = useCallback((next: GateState) => {
    writeGateState(eventId, next) // throws if the phone can't store it
    stateRef.current = next
    setState(next)
  }, [eventId])

  // Load what this phone already has (after hydration — the server has no
  // localStorage), then re-check the 12 h wipe every minute.
  useEffect(() => {
    const load = () => {
      const s = readGateState(eventId)
      stateRef.current = s
      setState(s)
      setPhone(readGatePhone())
    }
    const first = setTimeout(load, 0)
    const t = setInterval(load, 60_000)
    return () => { clearTimeout(first); clearInterval(t) }
  }, [eventId])

  const fetchList = useCallback(async (timeoutMs: number): Promise<GateList | 'invalid_pin' | null> => {
    try {
      const res = await postJson('/api/gate/list', { eventId, gatePin: pin }, timeoutMs)
      if (res.status === 403) return 'invalid_pin'
      return res.ok ? toGateList(res.data) : null
    } catch {
      return null
    }
  }, [eventId, pin])

  const nameThisPhone = useCallback((name: string) => {
    if (!name.trim()) return
    setPhone(saveGatePhoneName(name))
  }, [])

  const saveList = useCallback((list: GateList) => {
    try {
      commit({ ...stateRef.current, list, listDownloadedAt: new Date().toISOString() })
      return true
    } catch {
      setMessage({ tone: 'warn', text: "This phone couldn't store the gate list (storage full or blocked)." })
      return false
    }
  }, [commit])

  const download = useCallback(async () => {
    setAction('download'); setMessage(null)
    const list = await fetchList(DOWNLOAD_MS)
    if (list === 'invalid_pin') setMessage({ tone: 'warn', text: 'Gate PIN no longer valid — ask the organiser for the new gate link.' })
    else if (!list) setMessage({ tone: 'warn', text: "Couldn't download the gate list. Check the connection and try again." })
    else if (saveList(list)) setMessage({ tone: 'ok', text: 'Gate list downloaded.' })
    setAction(null)
  }, [fetchList, saveList])

  /** Tries a quick list update first; goes offline with the list it has if that fails. */
  const goOffline = useCallback(async () => {
    setAction('go_offline'); setMessage(null)
    const fresh = await fetchList(QUICK_UPDATE_MS)
    if (fresh && fresh !== 'invalid_pin') saveList(fresh)
    const current = stateRef.current
    if (!current.list) {
      setMessage({ tone: 'warn', text: 'No gate list on this phone — download it while online before using offline mode.' })
    } else {
      try {
        commit({ ...current, mode: 'offline' })
        setMessage(fresh && fresh !== 'invalid_pin'
          ? { tone: 'ok', text: 'Offline mode on. Gate list was just updated.' }
          : { tone: 'warn', text: "Offline mode on. Couldn't update the gate list — using the one already on this phone." })
      } catch {
        setMessage({ tone: 'warn', text: "This phone can't store offline scans (storage full or blocked). Stay online." })
      }
    }
    setAction(null)
  }, [fetchList, saveList, commit])

  /** Uploads Offline scans; stays offline until the upload succeeds. */
  const goOnline = useCallback(async (): Promise<UploadSummary | null> => {
    setAction('go_online'); setMessage(null)
    const current = stateRef.current
    let summary: UploadSummary = { recorded: 0, doubleEntries: 0, voided: 0, rejected: 0 }

    if (current.scans.length > 0) {
      if (!phone) {
        setMessage({ tone: 'warn', text: 'Name this phone first.' })
        setAction(null)
        return null
      }
      let res
      try {
        res = await postJson('/api/gate/offline-scans',
          { eventId, gatePin: pin, gatePhone: gatePhoneLabel(phone), scans: current.scans }, UPLOAD_MS)
      } catch {
        res = null
      }
      if (!res?.ok) {
        setMessage({ tone: 'warn', text: res?.status === 403
          ? 'Gate PIN no longer valid — scans are kept on this phone. Ask the organiser.'
          : `Still offline — couldn't upload ${current.scans.length} scan${current.scans.length === 1 ? '' : 's'}. They are kept on this phone; try again.` })
        setAction(null)
        return null
      }
      const results = ((res.data as { results?: { result: string }[] })?.results) ?? []
      summary = {
        recorded: results.filter(r => r.result === 'recorded' || r.result === 'already_uploaded').length,
        doubleEntries: results.filter(r => r.result === 'double_entry').length,
        voided: results.filter(r => r.result === 'voided').length,
        rejected: results.filter(r => r.result === 'rejected').length,
      }
    }

    commit({ ...stateRef.current, mode: 'online', scans: [] })
    const fresh = await fetchList(QUICK_UPDATE_MS)
    if (fresh && fresh !== 'invalid_pin') saveList(fresh)

    const problems = summary.doubleEntries + summary.voided + summary.rejected
    setMessage({
      tone: problems ? 'warn' : 'ok',
      text: current.scans.length === 0 ? 'Back online.'
        : `Back online. Uploaded ${summary.recorded} admission${summary.recorded === 1 ? '' : 's'}`
          + (problems ? ` · ${problems} reported to the organiser (${summary.doubleEntries} double entr${summary.doubleEntries === 1 ? 'y' : 'ies'})` : '')
          + '.',
    })
    setAction(null)
    return summary
  }, [eventId, pin, phone, commit, fetchList, saveList])

  /**
   * Decides an Offline scan from the Gate list. An Admission is saved on the
   * phone before it is shown, so it can't be lost.
   */
  const scanOffline = useCallback((reservationId: string): OfflineScanOutcome => {
    const current = stateRef.current
    if (!current.list) return { kind: 'denied', reservationId, message: 'No gate list on this phone' }
    const outcome = decideOfflineScan(current.list, current.scans, reservationId)
    if (outcome.kind === 'admitted') {
      try {
        commit({ ...current, scans: [...current.scans, { reservationId: outcome.reservationId, scannedAt: new Date().toISOString() }] })
      } catch {
        return { kind: 'denied', reservationId: outcome.reservationId, message: "Couldn't save on this phone — write the ID down and admit manually" }
      }
    }
    return outcome
  }, [commit])

  /** The approximate Door count this phone knows offline, including Offline scans just saved. */
  const offlineCount = useCallback((): GateDoorCount | null => {
    const current = stateRef.current
    return current.list ? offlineDoorCount(current.list, current.scans) : null
  }, [])

  return { state, phone, action, message, nameThisPhone, download, goOffline, goOnline, scanOffline, offlineCount, dismissMessage: () => setMessage(null) }
}
