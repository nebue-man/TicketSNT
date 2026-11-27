import { createAdminClient } from '@/lib/supabase/admin'

/** Door count for one event (GLOSSARY.md): every ticket in an admitted Reservation counts. */
export interface DoorCount {
  ticketsSold: number
  ticketsAdmitted: number
  ticketsAdmittedGate: number
  ticketsAdmittedBoxOffice: number
  reservationsAdmitted: number
}

export const EMPTY_DOOR_COUNT: DoorCount = {
  ticketsSold: 0, ticketsAdmitted: 0, ticketsAdmittedGate: 0, ticketsAdmittedBoxOffice: 0, reservationsAdmitted: 0,
}

/** Maps the admin_get_door_count payload; missing or bad fields count as 0. */
export function toDoorCount(raw: unknown): DoorCount {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const n = (k: string) => {
    const v = Number(r[k])
    return Number.isFinite(v) ? v : 0
  }
  return {
    ticketsSold: n('tickets_sold'),
    ticketsAdmitted: n('tickets_admitted'),
    ticketsAdmittedGate: n('tickets_admitted_gate'),
    ticketsAdmittedBoxOffice: n('tickets_admitted_box_office'),
    reservationsAdmitted: n('reservations_admitted'),
  }
}

/** Returns null if the count couldn't be loaded (shown as "unavailable", never as 0). */
export async function getDoorCount(eventId: string): Promise<DoorCount | null> {
  const supabase = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('admin_get_door_count', { p_event_id: eventId })
  if (error) {
    console.error('[getDoorCount] rpc error:', JSON.stringify(error))
    return null
  }
  return toDoorCount(data)
}
