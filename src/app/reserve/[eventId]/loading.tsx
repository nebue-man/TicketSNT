export default function Loading() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="topbar" />
      <main className="max-w-[1024px] mx-auto px-6 pt-10 pb-24 grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16 animate-pulse"
        aria-busy="true" aria-label="Loading event">
        <div>
          <div className="aspect-[4/5] max-h-[320px] lg:max-h-none w-full rounded-md bg-surface mb-6" />
          <div className="h-9 w-3/4 bg-surface rounded-sm mb-3" />
          <div className="h-4 w-56 bg-surface rounded-sm mb-2" />
          <div className="h-4 w-40 bg-surface rounded-sm" />
        </div>
        <div>
          <div className="h-12 w-full bg-surface rounded-full mb-10" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-[76px] w-full bg-surface rounded-md mb-3" />
          ))}
        </div>
      </main>
    </div>
  )
}
