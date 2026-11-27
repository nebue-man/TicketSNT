// What a Gate phone keeps for offline mode, in localStorage, per event:
// the mode staff chose, the Gate list, and Offline scans not yet uploaded.
//
// The Gate list (buyer names) is wiped on sign-out and 12 h after Doors.
// Offline scans hold only Reservation IDs and times, so they are kept until
// they upload — wiping them would lose Admissions the server doesn't know about.

import { isGateListExpired, type GateList, type OfflineScan } from './gate-list'

export type GateMode = 'online' | 'offline'

export interface GateState {
  mode: GateMode
  list: GateList | null
  listDownloadedAt: string | null // phone time, for the list's age
  scans: OfflineScan[]
}

export interface GatePhone {
  id: string   // random, stable per phone
  name: string // what staff call it, e.g. "Gate A"
}

const STATE_PREFIX = 'snt-gate-offline:'
const PHONE_KEY = 'snt-gate-phone'

export const EMPTY_GATE_STATE: GateState = { mode: 'online', list: null, listDownloadedAt: null, scans: [] }

type KeyValueStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>

function storage(s?: KeyValueStorage): KeyValueStorage {
  return s ?? window.localStorage
}

export function readGateState(eventId: string, now: Date = new Date(), s?: KeyValueStorage): GateState {
  let state: GateState
  try {
    const raw = storage(s).getItem(STATE_PREFIX + eventId)
    state = raw ? { ...EMPTY_GATE_STATE, ...(JSON.parse(raw) as Partial<GateState>) } : EMPTY_GATE_STATE
  } catch {
    return EMPTY_GATE_STATE
  }
  if (state.list && isGateListExpired(state.list, now)) {
    state = { ...state, list: null, listDownloadedAt: null }
    // Offline mode without a list can't decide anything; go back online.
    if (state.mode === 'offline') state.mode = 'online'
    writeGateState(eventId, state, s)
  }
  return state
}

/** Throws if the phone can't store it (e.g. storage full or blocked). */
export function writeGateState(eventId: string, state: GateState, s?: KeyValueStorage): void {
  const st = storage(s)
  if (!state.list && state.scans.length === 0 && state.mode === 'online') {
    st.removeItem(STATE_PREFIX + eventId)
    return
  }
  st.setItem(STATE_PREFIX + eventId, JSON.stringify(state))
}

/** Sign-out: wipe every Gate list on this phone, keeping Offline scans not yet uploaded. */
export function wipeGateLists(s?: KeyValueStorage): void {
  const st = storage(s)
  const keys: string[] = []
  for (let i = 0; i < st.length; i++) {
    const k = st.key(i)
    if (k?.startsWith(STATE_PREFIX)) keys.push(k)
  }
  for (const k of keys) {
    try {
      const state = JSON.parse(st.getItem(k) ?? '{}') as Partial<GateState>
      const scans = state.scans ?? []
      if (scans.length === 0) st.removeItem(k)
      else st.setItem(k, JSON.stringify({ ...EMPTY_GATE_STATE, mode: 'offline', scans }))
    } catch {
      st.removeItem(k)
    }
  }
}

export function readGatePhone(s?: KeyValueStorage): GatePhone | null {
  try {
    const raw = storage(s).getItem(PHONE_KEY)
    const p = raw ? (JSON.parse(raw) as GatePhone) : null
    return p?.id && p?.name ? p : null
  } catch {
    return null
  }
}

export function saveGatePhoneName(name: string, s?: KeyValueStorage): GatePhone {
  const existing = readGatePhone(s)
  const id = existing?.id ?? Math.random().toString(36).slice(2, 6).toUpperCase().padEnd(4, '0')
  const phone = { id, name: name.trim() }
  storage(s).setItem(PHONE_KEY, JSON.stringify(phone))
  return phone
}

/** How the phone is named in uploads and on the organiser's dashboard. */
export function gatePhoneLabel(phone: GatePhone): string {
  return `${phone.name} (${phone.id})`
}
