import type { OfflineScanIssue } from '@/lib/data/gate-offline'

function time(iso: string | null): string {
  return iso
    ? new Date(iso).toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo' })
    : '—'
}

/**
 * Offline scans the server couldn't turn into an Admission (ADR-0004): Double
 * entries and Reservations voided after the Gate list was downloaded. These
 * guests are already inside; the list is for the organiser to follow up.
 */
export function OfflineScanIssues({ issues }: { issues: OfflineScanIssue[] | null }) {
  if (issues === null) {
    return <p className="notice mt-3">Offline scan report unavailable.</p>
  }
  if (issues.length === 0) return null

  const doubles = issues.filter(i => i.issue === 'double_entry').length
  return (
    <section className="notice mt-3 p-6" aria-labelledby="offline-issues-h">
      <div className="flex flex-wrap justify-between items-baseline gap-2 mb-2">
        <h2 id="offline-issues-h" className="text-[13px] font-medium text-warn">Offline scan report</h2>
        <span className="meta">
          {doubles} double entr{doubles === 1 ? 'y' : 'ies'} · {issues.length - doubles} voided
        </span>
      </div>
      <ul className="divide-y divide-line">
        {issues.map(i => (
          <li key={`${i.reservationId}-${i.gatePhone}-${i.offlineScannedAt}`}
            className="py-3 flex flex-wrap justify-between gap-2">
            <div className="min-w-0">
              <p>{i.buyerName} <span className="mono text-muted text-[13px] ml-1">{i.reservationId}</span></p>
              <p className="meta">
                {i.issue === 'double_entry'
                  ? `Admitted again offline by ${i.gatePhone} at ${time(i.offlineScannedAt)}. First admitted ${i.originalSource === 'box_office' ? 'at the box office' : `by ${i.originalGatePhone ?? 'an online gate'}`} at ${time(i.originalScannedAt)}.`
                  : `Admitted offline by ${i.gatePhone} at ${time(i.offlineScannedAt)}, but the reservation was voided.`}
              </p>
            </div>
            <span className="meta tabular-nums">{i.tickets} ticket{i.tickets === 1 ? '' : 's'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
