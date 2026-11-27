import { describe, it, expect } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from './route'
import { SESSION_COOKIE_NAME } from '@/lib/auth'

describe('POST /api/auth/logout', () => {
  it('sends the browser to /login with a GET (303), on the same site', async () => {
    const res = await POST(new NextRequest('https://ticket-snt-6p4k.vercel.app/api/auth/logout', { method: 'POST' }))
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe('https://ticket-snt-6p4k.vercel.app/login')
  })

  it('clears the session cookie', async () => {
    const res = await POST(new NextRequest('https://ticketsnt.netlify.app/api/auth/logout', { method: 'POST' }))
    expect(res.headers.get('set-cookie')).toMatch(new RegExp(`^${SESSION_COOKIE_NAME}=;`))
  })
})
