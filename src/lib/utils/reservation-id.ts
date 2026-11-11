import { randomBytes } from 'crypto'

export function generateReservationId(): string {
  return 'RES-' + randomBytes(3).toString('hex').toUpperCase()
}
