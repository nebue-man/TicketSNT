import { callDb, DbFailure } from '@/lib/data/db'
import type { Event, EventStatus } from '@/types/database'

export type EventInsert = {
  name: string
  date_time: string
  venue: string
  description: string
  cover_image_url: string | null
  max_per_reservation: number
  gate_pin: string
  status: EventStatus
}

/** A write to an event: done, or why not. Routes turn the reason into a message and status. */
export type EventWrite<R extends string = never> = { ok: true } | { ok: false; reason: R | 'failed' }

/** Every event for the admin list. Throws DbFailure if the database can't answer. */
export async function getAllEvents(): Promise<Event[]> {
  const r = await callDb<Event[]>('admin_get_all_events')
  if (r.kind !== 'ok') throw new DbFailure('admin_get_all_events')
  return r.data ?? []
}

/** One event, or null if there is no such event. Throws DbFailure if the database can't answer. */
export async function getAdminEvent(id: string): Promise<Event | null> {
  const r = await callDb<Event[]>('admin_get_event', { p_id: id })
  if (r.kind !== 'ok') throw new DbFailure('admin_get_event')
  return r.data?.[0] ?? null
}

export async function createEvent(insert: EventInsert): Promise<{ ok: true; id: string } | { ok: false; reason: 'failed' }> {
  const r = await callDb<string>('admin_create_event', {
    p_name:                insert.name,
    p_date_time:           insert.date_time,
    p_venue:               insert.venue,
    p_description:         insert.description,
    p_cover_image_url:     insert.cover_image_url,
    p_max_per_reservation: insert.max_per_reservation,
    p_gate_pin:            insert.gate_pin,
    p_status:              insert.status,
  })
  return r.kind === 'ok' && typeof r.data === 'string' ? { ok: true, id: r.data } : { ok: false, reason: 'failed' }
}

/** Changes only the fields in `patch`. Not atomic: reads the event, then writes it back (candidate #3). */
export async function updateEvent(id: string, patch: Partial<EventInsert>): Promise<EventWrite<'not_found'>> {
  const read = await callDb<Event[]>('admin_get_event', { p_id: id })
  if (read.kind !== 'ok') return { ok: false, reason: 'failed' }
  const current = read.data?.[0]
  if (!current) return { ok: false, reason: 'not_found' }
  const r = await callDb('admin_update_event', {
    p_id:                  id,
    p_name:                patch.name                ?? current.name,
    p_date_time:           patch.date_time           ?? current.date_time,
    p_venue:               patch.venue               ?? current.venue,
    p_description:         patch.description         ?? current.description,
    p_cover_image_url:     patch.cover_image_url !== undefined ? patch.cover_image_url : current.cover_image_url,
    p_max_per_reservation: patch.max_per_reservation ?? current.max_per_reservation,
    p_gate_pin:            patch.gate_pin            ?? current.gate_pin,
    p_status:              patch.status              ?? current.status,
  })
  return r.kind === 'ok' ? { ok: true } : { ok: false, reason: 'failed' }
}

export async function closeEvent(id: string): Promise<EventWrite> {
  const r = await callDb('admin_close_event', { p_id: id })
  return r.kind === 'ok' ? { ok: true } : { ok: false, reason: 'failed' }
}

/** The lifecycle functions answer 'ok' or a reason (migration 0011). */
async function lifecycle<R extends string>(fn: string, id: string, reasons: readonly R[]): Promise<EventWrite<R>> {
  const r = await callDb<string>(fn, { p_id: id })
  if (r.kind !== 'ok') return { ok: false, reason: 'failed' }
  if (r.data === 'ok') return { ok: true }
  if ((reasons as readonly string[]).includes(r.data)) return { ok: false, reason: r.data as R }
  console.error(`[${fn}] unexpected answer:`, r.data)
  return { ok: false, reason: 'failed' }
}

/** Deletes an event made by mistake. Refused once it has any Reservation. */
export function deleteEvent(id: string) {
  return lifecycle('admin_delete_event', id, ['not_found', 'has_reservations'] as const)
}

/** Hides an ended event from the admin list, keeping all its records. */
export function archiveEvent(id: string) {
  return lifecycle('admin_archive_event', id, ['not_found'] as const)
}

/** Brings an archived event back as closed (sales stay shut). */
export function restoreEvent(id: string) {
  return lifecycle('admin_restore_event', id, ['not_found', 'not_archived'] as const)
}
