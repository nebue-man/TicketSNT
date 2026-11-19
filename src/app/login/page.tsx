'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const from = searchParams.get('from')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    const json = await res.json()
    if (!res.ok) {
      setError('Incorrect password')
      setLoading(false)
      return
    }
    // from param takes precedence over role-based default
    router.push(from ?? json.redirectTo ?? '/')
    router.refresh()
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
            Staff access
          </h1>
        </div>

        <form onSubmit={handleSubmit}>
          <label
            htmlFor="password"
            className="block text-ash-gray font-semibold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.35px' }}
          >
            Password
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
            {loading ? 'Signing in…' : 'Sign in'}
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
