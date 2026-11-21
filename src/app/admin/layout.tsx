import Link from 'next/link'
import { requireAuth } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAuth('admin')

  return (
    <div className="min-h-screen bg-void">
      <nav className="border-b border-[#1a1a1a] px-6 py-4">
        <div className="max-w-[1024px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="text-ash-gray font-semibold uppercase"
              style={{ fontSize: '11px', letterSpacing: '0.35px' }}>
              SNT · Admin
            </span>
            <Link href="/admin/events"
              className="text-ash-gray hover:text-bone-white transition-colors font-light"
              style={{ fontSize: '14px' }}>
              Events
            </Link>
          </div>
          <Link href="/"
            className="text-ash-gray hover:text-bone-white transition-colors font-light"
            style={{ fontSize: '13px' }}>
            ← Counter
          </Link>
        </div>
      </nav>
      <main className="max-w-[1024px] mx-auto px-6 py-12">
        {children}
      </main>
    </div>
  )
}
