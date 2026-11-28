'use client' // Error boundaries must be Client Components

// Shown when an admin page's read failed (ADR-0006: a failed read is never
// shown as an empty list). The admin nav above stays usable.
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  const digest = error instanceof Error && 'digest' in error ? String((error as Error & { digest?: string }).digest ?? '') : ''
  return (
    <section className="card p-8 max-w-[560px]" role="alert">
      <h1 className="h2 mb-2">Couldn’t reach the database</h1>
      <p className="meta mb-6">
        This page couldn’t load its data. Nothing was changed. Try again in a moment.
      </p>
      <button type="button" onClick={() => retry()} className="btn btn-primary">Try again</button>
      {digest && <p className="meta mono mt-6 text-[12px]">Error {digest}</p>}
    </section>
  )
}
