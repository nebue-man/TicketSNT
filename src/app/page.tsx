export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-void">
      <div className="text-center px-6">
        <p className="text-lime-spark font-semibold uppercase mb-4" style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          SNT Entertainment
        </p>
        <h1 className="text-bone-white font-normal mb-3" style={{ fontSize: '36px', lineHeight: 1.2 }}>
          Ticket Platform
        </h1>
        <p className="text-ash-gray font-light" style={{ fontSize: '15px' }}>
          Access via your event link.
        </p>
      </div>
    </main>
  )
}
