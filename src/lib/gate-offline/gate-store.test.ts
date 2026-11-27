import { describe, it, expect, beforeEach } from 'vitest'
import {
  readGateState, writeGateState, wipeGateLists, readGatePhone, saveGatePhoneName, gatePhoneLabel,
  EMPTY_GATE_STATE, type GateState,
} from './gate-store'
import type { GateList } from './gate-list'

class MemoryStorage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  getItem(k: string) { return this.m.get(k) ?? null }
  setItem(k: string, v: string) { this.m.set(k, v) }
  removeItem(k: string) { this.m.delete(k) }
}

const list: GateList = {
  eventId: 'ev1',
  doorsAt: '2026-12-01T13:30:00Z',
  generatedAt: '2026-12-01T13:00:00Z',
  reservations: { 'RES-AAAAAA': { buyerName: 'Amal', items: [], void: false, admittedAt: null } },
}
const DURING_DOORS = new Date('2026-12-01T14:00:00Z')
const NEXT_DAY = new Date('2026-12-02T09:00:00Z')

describe('gate store', () => {
  let s: MemoryStorage
  beforeEach(() => { s = new MemoryStorage() })

  it('starts online with nothing stored', () => {
    expect(readGateState('ev1', DURING_DOORS, s)).toEqual(EMPTY_GATE_STATE)
  })

  it('keeps the mode, list and Offline scans across page reloads', () => {
    const state: GateState = {
      mode: 'offline', list, listDownloadedAt: '2026-12-01T13:00:05Z',
      scans: [{ reservationId: 'RES-AAAAAA', scannedAt: '2026-12-01T13:45:00Z' }],
    }
    writeGateState('ev1', state, s)
    expect(readGateState('ev1', DURING_DOORS, s)).toEqual(state)
  })

  it('wipes the Gate list 12 h after Doors but keeps Offline scans, and goes back online', () => {
    const scans = [{ reservationId: 'RES-AAAAAA', scannedAt: '2026-12-01T13:45:00Z' }]
    writeGateState('ev1', { mode: 'offline', list, listDownloadedAt: 'x', scans }, s)
    expect(readGateState('ev1', NEXT_DAY, s)).toEqual({ mode: 'online', list: null, listDownloadedAt: null, scans })
    expect(s.getItem('snt-gate-offline:ev1')).not.toContain('Amal')
  })

  it('sign-out wipes every Gate list but keeps scans not yet uploaded', () => {
    const scans = [{ reservationId: 'RES-AAAAAA', scannedAt: '2026-12-01T13:45:00Z' }]
    writeGateState('ev1', { mode: 'offline', list, listDownloadedAt: 'x', scans }, s)
    writeGateState('ev2', { mode: 'online', list: { ...list, eventId: 'ev2' }, listDownloadedAt: 'x', scans: [] }, s)
    s.setItem('snt-gate-muted', '1')

    wipeGateLists(s)

    expect(readGateState('ev1', DURING_DOORS, s)).toEqual({ mode: 'offline', list: null, listDownloadedAt: null, scans })
    expect(s.getItem('snt-gate-offline:ev2')).toBeNull()
    expect(s.getItem('snt-gate-muted')).toBe('1')
  })

  it('treats corrupt storage as empty', () => {
    s.setItem('snt-gate-offline:ev1', '{not json')
    expect(readGateState('ev1', DURING_DOORS, s)).toEqual(EMPTY_GATE_STATE)
  })

  it('names the phone once and keeps its id when renamed', () => {
    expect(readGatePhone(s)).toBeNull()
    const a = saveGatePhoneName(' Gate A ', s)
    const b = saveGatePhoneName('Gate B', s)
    expect(a.name).toBe('Gate A')
    expect(b.id).toBe(a.id)
    expect(gatePhoneLabel(b)).toBe(`Gate B (${a.id})`)
  })
})
