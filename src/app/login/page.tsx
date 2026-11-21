'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const ROLE_LABELS = {
  staff: { pill: 'Staff', password: 'Staff password', submit: 'Sign in as staff' },
  admin: { pill: 'Admin', password: 'Admin password', submit: 'Sign in as admin' },
  gate:  { pill: 'Gate',  password: 'Gate password',  submit: 'Open gate scanner' },
} as const

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const roleParam = searchParams.get('role')
  const [role, setRole] = useState<'staff' | 'admin' | 'gate'>(
    roleParam === 'admin' ? 'admin' : roleParam === 'gate' ? 'gate' : 'staff'
  )
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const needsAdmin = roleParam === 'admin'

  function switchRole(next: 'staff' | 'admin' | 'gate') {
    setRole(next)
    setPassword('')
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, role }),
      })
      let json: { ok?: boolean; error?: string; redirectTo?: string; role?: string } = {}
      try { json = await res.json() } catch { /* non-JSON response */ }
      if (!res.ok) {
        setError(json.error ?? 'Incorrect password')
        return
      }
      // Admin always lands on the dashboard; staff recovers the page they came from.
      const destination = json.role === 'admin'
        ? '/admin/events'
        : (from ?? json.redirectTo ?? '/')
      router.push(destination)
      router.refresh()
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-void flex items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <div className="mb-10">
          <p
            className="text-lime-spark font-semibold uppercase mb-4"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}
          >
            SNT Entertainment
          </p>
          <h1
            className="text-bone-white font-normal"
            style={{ fontSize: '28px', lineHeight: 1.2, letterSpacing: '-0.02em' }}
          >
            Sign in
          </h1>
          {needsAdmin && (
            <p className="text-saffron-spark font-light mt-3" style={{ fontSize: '13px' }}>
              Admin access required. Please sign in as Admin.
            </p>
          )}
        </div>

        {/* Role toggle */}
        <div
          className="flex mb-8 p-1 rounded-full"
          style={{ backgroundColor: '#1a1a1a', border: '1px solid #2a2a2a' }}
        >
          {(['staff', 'admin', 'gate'] as const).map(r => (
            <button
              key={r}
              type="button"
              onClick={() => switchRole(r)}
              className="flex-1 font-semibold uppercase transition-all duration-200"
              style={{
                fontSize: '11px',
                letterSpacing: '0.35px',
                padding: '8px 0',
                borderRadius: '20px',
                backgroundColor: role === r ? '#7c3aed' : 'transparent',
                color: role === r ? '#fff' : '#555',
              }}
            >
              {ROLE_LABELS[r].pill}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="password"
            className="block text-ash-gray font-semibold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}
          >
            {ROLE_LABELS[role].password}
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            className="w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 mb-8 outline-none focus:border-electric-iris transition-colors"
            style={{ fontSize: '18px' }}
          />

          {error && (
            <p className="text-saffron-spark mb-6" style={{ fontSize: '14px' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full flex items-center justify-center bg-electric-iris text-bone-white font-semibold uppercase disabled:opacity-40 active:scale-[0.97] transition-[transform,opacity] duration-100 ease-out"
            style={{
              fontSize: '14px',
              letterSpacing: '0.025em',
              borderRadius: '24px',
              padding: '14px 32px',
            }}
          >
            {loading ? 'Signing in…' : ROLE_LABELS[role].submit}
          </button>
        </form>
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
