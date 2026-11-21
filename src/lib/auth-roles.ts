export const VALID_ROLES = ['admin', 'staff', 'gate'] as const
export type SessionRole = (typeof VALID_ROLES)[number]
