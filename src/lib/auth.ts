import { createHmac } from 'crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

export const SESSION_COOKIE_NAME = 'snt_session'
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60 // seconds

export function createSessionToken(): string {
  const timestamp = Date.now().toString()
  const mac = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(timestamp)
    .digest('hex')
  return `${timestamp}.${mac}`
}

export function verifySessionToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [timestamp, mac] = parts
  const age = Date.now() - parseInt(timestamp, 10)
  if (isNaN(age) || age > SESSION_DURATION_MS) return false
  const expected = createHmac('sha256', process.env.SESSION_SECRET!)
    .update(timestamp)
    .digest('hex')
  return mac === expected
}

export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token || !verifySessionToken(token)) {
    redirect('/login')
  }
}
