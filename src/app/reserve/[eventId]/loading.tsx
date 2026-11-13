export default function Loading() {
  return (
    <main className="min-h-screen bg-void px-6 py-16">
      <div className="max-w-[640px] mx-auto animate-pulse">
        <div className="mb-16 h-4 w-32 bg-[#1a1a1a] rounded" />
        <div className="mb-14 space-y-4">
          <div className="h-3 w-16 bg-[#1a1a1a] rounded" />
          <div className="h-10 w-3/4 bg-[#1a1a1a] rounded" />
          <div className="h-4 w-56 bg-[#1a1a1a] rounded" />
          <div className="h-4 w-40 bg-[#1a1a1a] rounded" />
        </div>
        <div className="h-3 w-24 bg-[#1a1a1a] rounded mb-6" />
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center justify-between py-5 border-b border-[#1a1a1a]">
            <div className="space-y-2">
              <div className="h-4 w-36 bg-[#1a1a1a] rounded" />
              <div className="h-3 w-20 bg-[#1a1a1a] rounded" />
            </div>
            <div className="flex items-center gap-4">
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a]" />
              <div className="w-5 h-4 bg-[#1a1a1a] rounded" />
              <div className="w-8 h-8 rounded-full bg-[#1a1a1a]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
