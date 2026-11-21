import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_PATHS = ['/login', '/api/auth']
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000

// Edge-compatible HMAC-SHA256 verify (Web Crypto API — no Node.js crypto)
async function isValidToken(token: string, secret: string): Promise<boolean> {
  const dotIdx = token.lastIndexOf('.')
  if (dotIdx === -1) return false
  const payload = token.slice(0, dotIdx)
  const mac = token.slice(dotIdx + 1)
  const parts = payload.split(':')
  if (parts.length !== 2) return false
  const [ts, role] = parts
  if (role !== 'admin' && role !== 'staff') return false
  const age = Date.now() - parseInt(ts, 10)
  if (isNaN(age) || age > SESSION_DURATION_MS) return false
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload))
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
  return mac === expected
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const session = request.cookies.get('snt_session')?.value
  const secret = process.env.SESSION_SECRET

  if (!session || !secret || !(await isValidToken(session, secret))) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('from', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
