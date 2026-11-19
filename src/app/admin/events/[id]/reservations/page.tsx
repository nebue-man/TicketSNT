import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAdminEvent } from '@/lib/data/admin/events'
import { getReservationsForEvent } from '@/lib/data/admin/reservations'
import { ReservationRow } from '@/components/admin/ReservationRow'
import { SearchInput } from '@/components/admin/SearchInput'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}

export default async function ReservationsPage({ params, searchParams }: Props) {
  const { id } = await params
  const { q } = await searchParams

  const [event, reservations] = await Promise.all([
    getAdminEvent(id),
    getReservationsForEvent(id, q),
  ])
  if (!event) notFound()

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link
            href={`/admin/events/${id}`}
            className="text-ash-gray hover:text-bone-white transition-colors font-light mb-3 block"
            style={{ fontSize: '13px' }}
          >
            ← {event.name}
          </Link>
          <h1
            className="text-bone-white font-normal"
            style={{ fontSize: '28px', letterSpacing: '-0.02em' }}
          >
            Reservations
          </h1>
        </div>
        <p className="text-ash-gray font-light" style={{ fontSize: '14px' }}>
          {reservations.length} result{reservations.length !== 1 ? 's' : ''}
        </p>
      </div>

      <SearchInput defaultValue={q} />

      <div className="mt-6 flex flex-col gap-2">
        {reservations.length === 0 ? (
          <p className="text-ash-gray font-light py-8" style={{ fontSize: '15px' }}>
            {q ? 'No results for that search.' : 'No reservations yet.'}
          </p>
        ) : (
          reservations.map(r => <ReservationRow key={r.id} reservation={r} />)
        )}
      </div>
    </div>
  )
}
