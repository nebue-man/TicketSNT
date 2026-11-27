import { NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  // 303 makes the browser GET /login. The default 307 repeats the POST, and the
  // login page doesn't accept POST (HTTP 405). Built from the request URL so it
  // stays on whichever deployment the user signed out from.
  const response = NextResponse.redirect(new URL('/login', req.url), 303)
  response.cookies.delete(SESSION_COOKIE_NAME)
  return response
}
