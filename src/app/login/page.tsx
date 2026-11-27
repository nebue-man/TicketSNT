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
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-bg flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex items-center gap-3 mb-10">
          <span className="mark" aria-hidden="true">S</span>
          <span className="brand">SNT Entertainment</span>
        </div>

        <div className="card p-6 sm:p-8">
          <h1 className="h1 mb-2">Sign in</h1>
          <p className="meta mb-6">Choose your role, then enter its password.</p>
          {needsAdmin && (
            <p className="notice mb-6">Admin access required. Sign in as Admin.</p>
          )}

          <div className="seg mb-6" role="group" aria-label="Role">
            {(['staff', 'admin', 'gate'] as const).map(r => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => switchRole(r)}>
                {ROLE_LABELS[r].pill}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <div className="field">
              <label htmlFor="password" className="label">{ROLE_LABELS[role].password}</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
                autoComplete="current-password"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'password-error' : undefined}
                className="input"
              />
              {error && <p id="password-error" className="field-error" role="alert">{error}</p>}
            </div>

            <button type="submit" disabled={loading || !password} className="btn btn-primary btn-block btn-lg">
              {loading ? 'Signing in…' : ROLE_LABELS[role].submit}
            </button>
          </form>
        </div>
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
