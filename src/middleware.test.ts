import { describe, it, expect, beforeAll } from 'vitest'
import { createHmac } from 'crypto'
import { NextRequest } from 'next/server'
import { middleware, config } from './middleware'
import type { SessionRole } from './lib/auth-roles'

const SECRET = 'test-secret'

function token(role: SessionRole, issuedAt = Date.now()) {
  const payload = `${issuedAt}:${role}`
  return `${payload}.${createHmac('sha256', SECRET).update(payload).digest('hex')}`
}

function request(path: string, role?: SessionRole, method = 'GET') {
  const headers = new Headers()
  if (role) headers.set('cookie', `snt_session=${token(role)}`)
  return new NextRequest(new URL(path, 'https://tickets.test'), { method, headers })
}

async function run(path: string, role?: SessionRole, method?: string) {
  const res = await middleware(request(path, role, method))
  const location = res.headers.get('location')
  return location ? { redirect: new URL(location).pathname + new URL(location).search } : { allowed: true }
}

beforeAll(() => { process.env.SESSION_SECRET = SECRET })

describe('middleware — gate role', () => {
  it('allows the gate scanner page', async () => {
    expect(await run('/gate/evt-1?pin=1234', 'gate')).toEqual({ allowed: true })
  })

  it('allows the scan API the scanner calls', async () => {
    expect(await run('/api/gate/scan', 'gate', 'POST')).toEqual({ allowed: true })
  })

  it.each(['/', '/admin/events', '/reserve/evt-1', '/api/reserve', '/api/admin/events'])(
    'blocks %s',
    async path => {
      expect(await run(path, 'gate')).toEqual({ redirect: '/login' })
    },
  )
})

describe('middleware — other roles and no session', () => {
  it('lets admin and staff use the scan API', async () => {
    expect(await run('/api/gate/scan', 'admin', 'POST')).toEqual({ allowed: true })
    expect(await run('/api/gate/scan', 'staff', 'POST')).toEqual({ allowed: true })
  })

  it('sends a visitor with no session to login, remembering where they were going', async () => {
    expect(await run('/gate/evt-1')).toEqual({ redirect: '/login?from=%2Fgate%2Fevt-1' })
  })

  it('rejects a session signed with a different secret', async () => {
    const payload = `${Date.now()}:gate`
    const forged = `${payload}.${createHmac('sha256', 'wrong').update(payload).digest('hex')}`
    const res = await middleware(new NextRequest('https://tickets.test/api/gate/scan', {
      method: 'POST', headers: { cookie: `snt_session=${forged}` },
    }))
    expect(new URL(res.headers.get('location')!).pathname).toBe('/login')
  })

  it('leaves the login page and auth API public', async () => {
    expect(await run('/login')).toEqual({ allowed: true })
    expect(await run('/api/auth/login', undefined, 'POST')).toEqual({ allowed: true })
  })
})

describe('middleware matcher', () => {
  // Next.js anchors matcher patterns to the whole path.
  const matches = (path: string) => config.matcher.some(m => new RegExp(`^${m}$`).test(path))

  it('skips the QR decoder .wasm so the scanner can load it', () => {
    expect(matches('/zxing/zxing_reader.wasm')).toBe(false)
  })

  it('still checks sessions on pages and APIs', () => {
    for (const path of ['/', '/gate/evt-1', '/api/gate/scan', '/admin/events', '/zxing']) {
      expect(matches(path)).toBe(true)
    }
  })
})
