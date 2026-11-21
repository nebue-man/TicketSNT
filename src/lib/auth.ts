import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { VALID_ROLES, type SessionRole } from './auth-roles'

export type { SessionRole } from './auth-roles'

const SESSION_COOKIE = 'snt_session'
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export function createSessionToken(role: SessionRole): string {
  const payload = `${Date.now()}:${role}`
  const mac = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(payload)
    .digest('hex')
  return `${payload}.${mac}`
}

export function verifySessionToken(token: string): { valid: true; role: SessionRole } | { valid: false } {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return { valid: false }
  const payload = token.slice(0, dotIdx)
  const mac = token.slice(dotIdx + 1)
  const parts = payload.split(':')
  if (parts.length !== 2) return { valid: false }
  const [timestamp, role] = parts
  if (!VALID_ROLES.includes(role as SessionRole)) return { valid: false }
  const age = Date.now() - parseInt(timestamp, 10)
  if (isNaN(age) || age > SESSION_DURATION_MS) return { valid: false }
  const expected = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(payload)
    .digest('hex')
  if (mac !== expected) return { valid: false }
  return { valid: true, role: role as SessionRole }
}

// No argument = any authenticated role (staff, admin, or gate).
// Pass 'admin' to restrict access to admin sessions only — staff/gate sessions redirect to /login?role=admin.
export async function requireAuth(requiredRole?: SessionRole): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) redirect('/login')
  const result = verifySessionToken(token)
  if (!result.valid) redirect('/login')
  if (requiredRole === 'admin' && result.role !== 'admin') redirect('/login?role=admin')
}

// Returns the role of the current session, or null if unauthenticated/invalid.
export async function getSessionRole(): Promise<SessionRole | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  const result = verifySessionToken(token)
  return result.valid ? result.role : null
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60
