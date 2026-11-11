export interface ReservationInputItem {
  ticket_type_id: string
  quantity: number
}

export interface ReservationInput {
  buyer_name: string
  buyer_email: string
  buyer_phone: string
  items: ReservationInputItem[]
  consent: boolean
}

export type ValidationResult =
  | { valid: true; data: ReservationInput }
  | { valid: false; error: string }

export function validateReservationInput(
  raw: unknown,
  maxPerReservation: number
): ValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { valid: false, error: 'Invalid request body' }
  }

  const r = raw as Record<string, unknown>

  if (typeof r.buyer_name !== 'string' || !r.buyer_name.trim()) {
    return { valid: false, error: 'Name is required' }
  }

  if (typeof r.buyer_email !== 'string' || !r.buyer_email.includes('@')) {
    return { valid: false, error: 'Valid email is required' }
  }

  if (typeof r.buyer_phone !== 'string' || !r.buyer_phone.trim()) {
    return { valid: false, error: 'Phone is required' }
  }

  if (!Array.isArray(r.items) || r.items.length === 0) {
    return { valid: false, error: 'At least one ticket must be selected' }
  }

  for (const item of r.items as unknown[]) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return { valid: false, error: 'Invalid item format' }
    }
    const i = item as Record<string, unknown>
    if (typeof i.ticket_type_id !== 'string' || !i.ticket_type_id) {
      return { valid: false, error: 'Invalid ticket type' }
    }
    if (
      typeof i.quantity !== 'number' ||
      !Number.isInteger(i.quantity) ||
      i.quantity < 1
    ) {
      return { valid: false, error: 'Quantity must be at least 1' }
    }
  }

  const total = (r.items as ReservationInputItem[]).reduce(
    (sum, item) => sum + item.quantity,
    0
  )
  if (total > maxPerReservation) {
    return { valid: false, error: `Maximum ${maxPerReservation} tickets per reservation` }
  }

  if (r.consent !== true) {
    return { valid: false, error: 'Consent is required' }
  }

  return {
    valid: true,
    data: {
      buyer_name: (r.buyer_name as string).trim(),
      buyer_email: (r.buyer_email as string).trim().toLowerCase(),
      buyer_phone: (r.buyer_phone as string).trim(),
      items: r.items as ReservationInputItem[],
      consent: true,
    },
  }
}
