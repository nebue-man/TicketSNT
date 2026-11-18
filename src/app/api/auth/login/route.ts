import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from '@/lib/auth'

export async function POST(req: NextRequest) {
  let body: { password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  if (body.password !== process.env.ADMIN_PASSWORD) {
    await new Promise(r => setTimeout(r, 300))
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
  }

  const token = createSessionToken()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/',
  })
  return response
}
