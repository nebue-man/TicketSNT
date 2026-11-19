'use client'

import { useRouter, usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'

export function SearchInput({ defaultValue }: { defaultValue?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(defaultValue ?? '')

  useEffect(() => {
    const timer = setTimeout(() => {
      const url = value.trim()
        ? `${pathname}?q=${encodeURIComponent(value.trim())}`
        : pathname
      router.push(url)
    }, 300)
    return () => clearTimeout(timer)
  }, [value, pathname, router])

  return (
    <input
      type="search"
      value={value}
      onChange={e => setValue(e.target.value)}
      placeholder="Search by name, NIC, or reservation ID…"
      className="w-full bg-transparent border-b border-[#333] text-bone-white font-light pb-3 outline-none focus:border-electric-iris transition-colors placeholder:text-[#444]"
      style={{ fontSize: '16px' }}
    />
  )
}
