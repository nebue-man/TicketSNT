import type { EventStatus } from '@/types/database'

const LABELS: Record<EventStatus, string> = {
  published: 'Published',
  draft: 'Draft',
  closed: 'Closed',
  archived: 'Archived',
}

export function StatusBadge({ status }: { status: EventStatus }) {
  return <span className="badge" data-status={status}>{LABELS[status]}</span>
}
