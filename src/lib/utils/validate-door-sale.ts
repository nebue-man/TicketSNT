// A Door sale is a Reservation sold at the box office during Doors; the sale is
// its Admission (GLOSSARY.md). Either it happens now, or it was written on paper
// during an outage and is entered later with the time written down.

export type DoorSale = { admittedAt: string | null } // null = admitted now

export type DoorSaleValidation =
  | { valid: true; doorSale: DoorSale | null }       // null = ordinary Reservation
  | { valid: false; error: string }

const CLOCK_SKEW_MS = 5 * 60 * 1000             // a box-office clock a few minutes fast
const MAX_PAPER_AGE_MS = 7 * 24 * 60 * 60 * 1000 // paper sales are entered within a week

export function validateDoorSale(raw: unknown, now: Date = new Date()): DoorSaleValidation {
  if (raw === undefined || raw === null) return { valid: true, doorSale: null }
  if (typeof raw !== 'object' || Array.isArray(raw)) return { valid: false, error: 'Invalid door sale' }

  const r = raw as Record<string, unknown>
  if (r.mode === 'now') return { valid: true, doorSale: { admittedAt: null } }
  if (r.mode !== 'paper') return { valid: false, error: 'Invalid door sale' }

  if (typeof r.admitted_at !== 'string') return { valid: false, error: 'Enter the time written on the paper' }
  const at = new Date(r.admitted_at)
  if (Number.isNaN(at.getTime())) return { valid: false, error: 'Enter the time written on the paper' }
  if (at.getTime() > now.getTime() + CLOCK_SKEW_MS) return { valid: false, error: 'The paper sale time is in the future' }
  if (at.getTime() < now.getTime() - MAX_PAPER_AGE_MS) return { valid: false, error: 'The paper sale time is more than 7 days ago' }

  return { valid: true, doorSale: { admittedAt: at.toISOString() } }
}
