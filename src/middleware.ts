import { NextRequest, NextResponse } from 'next/server'
import { VALID_ROLES } from '@/lib/auth-roles'

const PUBLIC_PATHS = ['/login', '/api/auth']
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

// Edge-compatible HMAC-SHA256 verify (Web Crypto API — no Node.js crypto).
// Returns the verified role string on success, null on any failure.
async function verifyToken(token: string, secret: string): Promise<string | null> {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return null
  const payload = token.slice(0, dotIdx)
  const mac = token.slice(dotIdx + 1)
  const parts = payload.split(':')
  if (parts.length !== 2) return null
  const [ts, role] = parts
  if (!VALID_ROLES.includes(role as (typeof VALID_ROLES)[number])) return null
  const age = Date.now() - parseInt(ts, 10)
  if (isNaN(age) || age > SESSION_DURATION_MS) return null
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return mac === expected ? role : null
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const session = request.cookies.get('snt_session')?.value
  const secret = process.env.SESSION_SECRET
  const role = session && secret ? await verifyToken(session, secret) : null

  if (!role) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname + search)
    return NextResponse.redirect(loginUrl)
  }

  // Gate sessions may only access /gate/* routes.
  if (role === 'gate' && !pathname.startsWith('/gate')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
