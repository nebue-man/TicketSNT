import { describe, it, expect, vi } from 'vitest'

// The database adapter: scan_reservation answers with everything it knows about the buyer.
const rpc = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({ rpc }) }))

const { scanReservation } = await import('./gate')

describe('scanReservation', () => {
  it("never passes the buyer's email or phone to the Gate phone", async () => {
    rpc.mockResolvedValue({
      error: null,
      data: {
        code: 'admitted', reservation_id: 'RES-AAAAAA', buyer_name: 'Amal',
        buyer_email: 'amal@example.com', buyer_phone: '0771234567',
        items: [{ ticket_type_name: 'General', quantity: 2 }],
      },
    })
    const result = await scanReservation('RES-AAAAAA', 'ev1', '1234')
    expect(result).toEqual({
      ok: true, alreadyScanned: false,
      reservation: { id: 'RES-AAAAAA', buyer_name: 'Amal', items: [{ ticket_type_name: 'General', quantity: 2 }] },
    })
  })
})
