import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import type { ScanResult } from '@/lib/data/gate'
import type { DoorCount } from '@/lib/data/admin/door-count'

// The two database adapters behind the route.
const scanReservation = vi.fn<(id: string, eventId: string, pin: string) => Promise<ScanResult>>()
const getDoorCount = vi.fn<(eventId: string) => Promise<DoorCount | null>>()
vi.mock('@/lib/data/gate', () => ({ scanReservation: (...a: [string, string, string]) => scanReservation(...a) }))
vi.mock('@/lib/data/admin/door-count', () => ({ getDoorCount: (id: string) => getDoorCount(id) }))

const { POST } = await import('./route')

const COUNT: DoorCount = {
  ticketsSold: 800, ticketsAdmitted: 312, ticketsAdmittedGate: 290, ticketsAdmittedBoxOffice: 22, reservationsAdmitted: 120,
}
const RESERVATION = { id: 'RES-AAAAAA', buyer_name: 'Amal', buyer_email: '', buyer_phone: '', items: [] }

async function scan() {
  const res = await POST(new NextRequest('https://tickets.test/api/gate/scan', {
    method: 'POST',
    body: JSON.stringify({ reservationId: 'res-aaaaaa', eventId: 'ev1', gatePin: '1234' }),
  }))
  return { status: res.status, body: await res.json() }
}

describe('POST /api/gate/scan — Door count', () => {
  beforeEach(() => {
    scanReservation.mockReset()
    getDoorCount.mockReset().mockResolvedValue(COUNT)
  })

  it('returns the Door count with an Admission', async () => {
    scanReservation.mockResolvedValue({ ok: true, reservation: RESERVATION, alreadyScanned: false })
    const { status, body } = await scan()
    expect(status).toBe(200)
    expect(body.doorCount).toEqual({ ticketsAdmitted: 312, ticketsSold: 800 })
    expect(getDoorCount).toHaveBeenCalledWith('ev1')
  })

  it('returns the Door count with Not admitted, e.g. a ticket for another event', async () => {
    scanReservation.mockResolvedValue({ ok: false, error: 'wrong_event' })
    const { status, body } = await scan()
    expect(status).toBe(400)
    expect(body).toEqual({ error: 'wrong_event', doorCount: { ticketsAdmitted: 312, ticketsSold: 800 } })
  })

  it('never returns the Door count for a wrong gate PIN', async () => {
    scanReservation.mockResolvedValue({ ok: false, error: 'invalid_pin' })
    const { status, body } = await scan()
    expect(status).toBe(403)
    expect(body).toEqual({ error: 'invalid_pin' })
    expect(getDoorCount).not.toHaveBeenCalled()
  })

  it('shows the Door count as unavailable, never the numbers, when the PIN could not be checked', async () => {
    scanReservation.mockResolvedValue({ ok: false, error: 'unknown' })
    const { body } = await scan()
    expect(body).toEqual({ error: 'unknown', doorCount: null })
    expect(getDoorCount).not.toHaveBeenCalled()
  })

  it('still admits when loading the Door count throws', async () => {
    scanReservation.mockResolvedValue({ ok: true, reservation: RESERVATION, alreadyScanned: false })
    getDoorCount.mockRejectedValue(new Error('connection reset'))
    const { status, body } = await scan()
    expect(status).toBe(200)
    expect(body).toMatchObject({ ok: true, doorCount: null })
  })

  it('does not hold up the Scan outcome for a slow Door count', async () => {
    vi.useFakeTimers()
    try {
      scanReservation.mockResolvedValue({ ok: true, reservation: RESERVATION, alreadyScanned: false })
      getDoorCount.mockReturnValue(new Promise(() => {})) // never answers
      const pending = scan()
      await vi.advanceTimersByTimeAsync(1500)
      const { status, body } = await pending
      expect(status).toBe(200)
      expect(body).toMatchObject({ ok: true, doorCount: null })
    } finally {
      vi.useRealTimers()
    }
  })

  it('still admits when the Door count cannot be loaded', async () => {
    scanReservation.mockResolvedValue({ ok: true, reservation: RESERVATION, alreadyScanned: false })
    getDoorCount.mockResolvedValue(null)
    const { status, body } = await scan()
    expect(status).toBe(200)
    expect(body).toMatchObject({ ok: true, alreadyScanned: false, doorCount: null })
  })
})
