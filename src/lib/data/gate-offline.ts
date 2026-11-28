import { callDb, isUuid } from '@/lib/data/db'
import { toGateList, type OfflineScan } from '@/lib/gate-offline/gate-list'

// `payload` is the gate_get_list result as-is (no email, phone or NIC in it);
// the phone maps it with toGateList.
export type GateListResult =
  | { ok: true; payload: unknown }
  | { ok: false; error: 'invalid_pin' | 'not_found' | 'unknown' }

export async function getGateList(eventId: string, gatePin: string): Promise<GateListResult> {
  if (!isUuid(eventId)) return { ok: false, error: 'not_found' }
  const r = await callDb('gate_get_list', { p_event_id: eventId, p_gate_pin: gatePin })
  if (r.kind !== 'ok') return { ok: false, error: 'unknown' }
  const data = r.data
  const code = (data as { code?: string } | null)?.code
  if (code === 'invalid_pin' || code === 'not_found') return { ok: false, error: code }
  return toGateList(data) ? { ok: true, payload: data } : { ok: false, error: 'unknown' }
}

export type UploadResultCode = 'recorded' | 'already_uploaded' | 'double_entry' | 'voided' | 'rejected'

export type UploadResult =
  | { ok: true; results: { reservationId: string; result: UploadResultCode }[] }
  | { ok: false; error: 'invalid_pin' | 'not_found' | 'invalid_input' | 'unknown' }

export const MAX_SCANS_PER_UPLOAD = 5000

export async function uploadOfflineScans(
  eventId: string,
  gatePin: string,
  gatePhone: string,
  scans: OfflineScan[],
): Promise<UploadResult> {
  if (!isUuid(eventId)) return { ok: false, error: 'not_found' }
  const r = await callDb('gate_upload_offline_scans', {
    p_event_id: eventId,
    p_gate_pin: gatePin,
    p_gate_phone: gatePhone,
    p_scans: scans.map(s => ({ reservation_id: s.reservationId, scanned_at: s.scannedAt })),
  })
  if (r.kind !== 'ok') return { ok: false, error: 'unknown' }
  const d = r.data as { code?: string; results?: { reservation_id: string; result: UploadResultCode }[] } | null
  if (d?.code === 'invalid_pin' || d?.code === 'not_found' || d?.code === 'invalid_input') return { ok: false, error: d.code }
  if (d?.code !== 'ok' || !Array.isArray(d.results)) return { ok: false, error: 'unknown' }
  return { ok: true, results: d.results.map(row => ({ reservationId: row.reservation_id, result: row.result })) }
}

export interface OfflineScanIssue {
  reservationId: string
  buyerName: string
  tickets: number
  issue: 'double_entry' | 'voided'
  gatePhone: string
  offlineScannedAt: string
  originalScannedAt: string | null
  originalSource: string | null
  originalGatePhone: string | null
}

/** Returns null if the issues couldn't be loaded. */
export async function getOfflineScanIssues(eventId: string): Promise<OfflineScanIssue[] | null> {
  if (!isUuid(eventId)) return []
  const r = await callDb('admin_get_offline_scan_issues', { p_event_id: eventId })
  if (r.kind !== 'ok') return null
  return ((r.data as Record<string, unknown>[] | null) ?? []).map(row => ({
    reservationId: String(row.reservation_id),
    buyerName: String(row.buyer_name ?? ''),
    tickets: Number(row.tickets) || 0,
    issue: row.issue === 'voided' ? 'voided' : 'double_entry',
    gatePhone: String(row.gate_phone ?? ''),
    offlineScannedAt: String(row.offline_scanned_at),
    originalScannedAt: (row.original_scanned_at as string | null) ?? null,
    originalSource: (row.original_source as string | null) ?? null,
    originalGatePhone: (row.original_gate_phone as string | null) ?? null,
  }))
}
