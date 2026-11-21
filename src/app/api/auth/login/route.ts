import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { password?: string; role?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  await new Promise(r => setTimeout(r, 300))

  const hintedRole = body.role === 'admin' || body.role === 'staff' ? body.role : null

  let role: 'admin' | 'staff' | null = null
  if (body.password === process.env.ADMIN_PASSWORD && (!hintedRole || hintedRole === 'admin')) role = 'admin'
  else if (body.password === process.env.STAFF_PASSWORD && (!hintedRole || hintedRole === 'staff')) role = 'staff'

  if (!role) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  if (!process.env.SESSION_SECRET) {
    console.error('[login] SESSION_SECRET env var is not set')
    return NextResponse.json({ error: 'Server misconfiguration: SESSION_SECRET missing' }, { status: 500 })
  }

  try {
    const token = createSessionToken(role)
    const redirectTo = role === 'admin' ? '/admin/events' : '/'
    const response = NextResponse.json({ ok: true, role, redirectTo })
    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE,
      path: '/',
    })
    return response
  } catch (err) {
    console.error('[login] createSessionToken failed:', err)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
}
