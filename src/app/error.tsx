'use client' // Error boundaries must be Client Components

// Shown when a counter or gate page's read failed (ADR-0006: a failed read is
// never shown as an empty list or "not found"). The admin pages have their own.
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && 'digest' in error ? String((error as Error & { digest?: string }).digest ?? '') : ''
  return (
    <main className="min-h-screen bg-bg px-6 pt-24">
      <section className="card p-8 max-w-[480px] mx-auto" role="alert">
        <h1 className="h2 mb-2">Something went wrong</h1>
        <p className="meta mb-6">Please try again in a moment.</p>
        <button type="button" onClick={() => retry()} className="btn btn-primary">Try again</button>
        {digest && <p className="meta mono mt-6 text-[12px]">Error {digest}</p>}
      </section>
    </main>
  )
}
