import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The database adapter, answering by database function name.
const answers: Record<string, () => Promise<{ data: unknown; error: unknown }>> = {}
const rpc = vi.fn((fn: string) => answers[fn]())
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))

const { POST } = await import('./route')

const scanAnswers = (data: unknown, error: unknown = null) => { answers.scan_reservation = async () => ({ data, error }) }
const COUNT = { tickets_sold: 800, tickets_admitted: 312, tickets_admitted_gate: 290, tickets_admitted_box_office: 22, reservations_admitted: 120 }
const ADMITTED = {
  code: 'admitted', reservation_id: 'RES-AAAAAA', buyer_name: 'Amal',
  buyer_email: 'amal@example.com', buyer_phone: '0771234567',
  items: [{ ticket_type_name: 'General', quantity: 2 }],
}

async function scan(body: unknown = { reservationId: 'res-aaaaaa', eventId: 'ev1', gatePin: '1234' }) {
  const res = await POST(new NextRequest('https://tickets.test/api/gate/scan-outcome', { method: 'POST', body: JSON.stringify(body) }))
  return { status: res.status, body: await res.json() }
}

describe('POST /api/gate/scan-outcome', () => {
  beforeEach(() => {
    rpc.mockClear()
    answers.admin_get_door_count = async () => ({ data: COUNT, error: null })
  })

  it('answers an Admission with the reservation and the live Door count', async () => {
    scanAnswers(ADMITTED)
    expect(await scan()).toEqual({
      status: 200,
      body: {
        outcome: 'admitted',
        reservation: { id: 'RES-AAAAAA', buyerName: 'Amal', items: [{ ticket_type_name: 'General', quantity: 2 }] },
        doorCount: { status: 'live', ticketsAdmitted: 312, ticketsSold: 800 },
      },
    })
  })

  it('normalises a typed Reservation ID before scanning', async () => {
    scanAnswers(ADMITTED)
    await scan({ reservationId: '  res-aaaaaa ', eventId: 'ev1', gatePin: '1234' })
    expect(rpc).toHaveBeenCalledWith('scan_reservation', { p_reservation_id: 'RES-AAAAAA', p_event_id: 'ev1', p_gate_pin: '1234' })
  })

  it('answers a Re-scan with the time of the original Admission', async () => {
    scanAnswers({ ...ADMITTED, code: 'already_scanned', scanned_at: '2026-12-01T14:05:00Z' })
    expect((await scan()).body).toMatchObject({ outcome: 'already_scanned', admittedAt: '2026-12-01T14:05:00Z' })
  })

  it('answers Not admitted with 200 and the reason, with the Door count', async () => {
    scanAnswers({ code: 'voided' })
    expect(await scan()).toEqual({
      status: 200,
      body: { outcome: 'not_admitted', reservationId: 'RES-AAAAAA', reason: 'voided', doorCount: { status: 'live', ticketsAdmitted: 312, ticketsSold: 800 } },
    })
  })

  it('withholds the Door count for a wrong gate PIN, without loading it', async () => {
    scanAnswers({ code: 'invalid_pin' })
    expect((await scan()).body).toEqual({ outcome: 'not_admitted', reservationId: 'RES-AAAAAA', reason: 'invalid_pin', doorCount: { status: 'withheld' } })
    expect(rpc).not.toHaveBeenCalledWith('admin_get_door_count', expect.anything())
  })

  it('answers 500 when the database could not decide, so the phone shows Not checked', async () => {
    scanAnswers(null, { message: 'connection reset' })
    const { status, body } = await scan()
    expect(status).toBe(500)
    expect(body).not.toHaveProperty('doorCount')
  })

  it('answers 400 for a request missing the gate PIN', async () => {
    expect((await scan({ reservationId: 'RES-AAAAAA', eventId: 'ev1' })).status).toBe(400)
  })

  it('still answers the Admission when the Door count fails or is slow', async () => {
    scanAnswers(ADMITTED)
    answers.admin_get_door_count = async () => { throw new Error('connection reset') }
    expect((await scan()).body).toMatchObject({ outcome: 'admitted', doorCount: { status: 'unavailable' } })

    vi.useFakeTimers()
    try {
      answers.admin_get_door_count = () => new Promise(() => {})
      const pending = scan()
      await vi.advanceTimersByTimeAsync(1500)
      expect((await pending).body).toMatchObject({ outcome: 'admitted', doorCount: { status: 'unavailable' } })
    } finally {
      vi.useRealTimers()
    }
  })
})
