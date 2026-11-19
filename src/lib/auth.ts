import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export type SessionRole = 'admin' | 'staff'

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
  if (role !== 'admin' && role !== 'staff') return { valid: false }
  const age = Date.now() - parseInt(timestamp, 10)
  if (isNaN(age) || age > SESSION_DURATION_MS) return { valid: false }
  const expected = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(payload)
    .digest('hex')
  if (mac !== expected) return { valid: false }
  return { valid: true, role: role as SessionRole }
}

// No argument = any authenticated role (staff or admin).
// Pass 'admin' to restrict access to admin sessions only — staff sessions redirect to /login.
export async function requireAuth(requiredRole?: SessionRole): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) redirect('/login')
  const result = verifySessionToken(token)
  if (!result.valid) redirect('/login')
  if (requiredRole === 'admin' && result.role !== 'admin') redirect('/login')
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60
