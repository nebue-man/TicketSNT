import Link from 'next/link'
import { requireAuth } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAuth('admin')

  return (
    <div className="min-h-screen bg-bg">
      <header className="topbar px-6">
        <div className="max-w-[1024px] h-full mx-auto flex items-center justify-between gap-6">
          <div className="flex items-center gap-8">
            <Link href="/admin/events" className="flex items-center gap-3">
              <span className="mark" aria-hidden="true">S</span>
              <span className="brand">SNT Admin</span>
            </Link>
            <nav className="flex items-center gap-6" aria-label="Admin">
              <Link href="/admin/events" className="navlink">Events</Link>
              <Link href="/" className="navlink">Counter</Link>
            </nav>
          </div>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="navlink">Sign out</button>
          </form>
        </div>
      </header>
      <main className="max-w-[1024px] mx-auto px-6 pt-12 pb-24">
        {children}
      </main>
    </div>
  )
}
