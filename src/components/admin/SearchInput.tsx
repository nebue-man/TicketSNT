'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

export function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue ?? '')
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    const timer = setTimeout(() => {
      const url = value.trim()
        ? `${pathname}?q=${encodeURIComponent(value.trim())}`
        : pathname
      router.push(url)
    }, 300)
    return () => clearTimeout(timer)
  }, [value, pathname, router])

  return (
    <div className="field">
      <label htmlFor="reservation-search" className="label">Search reservations</label>
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
          width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          id="reservation-search"
          type="search"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Name, NIC or reservation ID"
          className="input pl-11"
        />
      </div>
    </div>
  )
}
