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
    return (
      <div className="p-6 border border-[#1a1a1a] mb-6" style={{ borderRadius: '16px' }}>
        <p className="font-light" style={{ fontSize: '14px', color: '#ffb829' }}>Offline scan report unavailable.</p>
      </div>
    )
  }
  if (issues.length === 0) return null

  const doubles = issues.filter(i => i.issue === 'double_entry').length
  return (
    <div className="p-6 border mb-6" style={{ borderRadius: '16px', borderColor: '#ffb82955' }}>
      <div className="flex justify-between items-baseline mb-4">
        <span className="font-semibold uppercase" style={{ fontSize: '11px', letterSpacing: '0.35px', color: '#ffb829' }}>
          Offline scan report
        </span>
        <span className="text-ash-gray font-light" style={{ fontSize: '12px' }}>
          {doubles} double entr{doubles === 1 ? 'y' : 'ies'} · {issues.length - doubles} voided
        </span>
      </div>
      <div className="flex flex-col">
        {issues.map(i => (
          <div key={`${i.reservationId}-${i.gatePhone}-${i.offlineScannedAt}`}
            className="py-3 flex flex-wrap justify-between gap-2" style={{ borderTop: '1px solid #1a1a1a', fontSize: '14px' }}>
            <div>
              <p className="text-bone-white">{i.buyerName} <span className="text-ash-gray tracking-widest">{i.reservationId}</span></p>
              <p className="text-ash-gray font-light">
                {i.issue === 'double_entry'
                  ? `Admitted again offline by ${i.gatePhone} at ${time(i.offlineScannedAt)} — first admitted ${i.originalSource === 'box_office' ? 'at the box office' : `by ${i.originalGatePhone ?? 'an online gate'}`} at ${time(i.originalScannedAt)}`
                  : `Admitted offline by ${i.gatePhone} at ${time(i.offlineScannedAt)}, but the reservation was voided`}
              </p>
            </div>
            <span className="text-ash-gray tabular-nums">{i.tickets} ticket{i.tickets === 1 ? '' : 's'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
