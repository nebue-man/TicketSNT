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
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <Link href={`/admin/events/${id}`} className="navlink">← {event.name}</Link>
          <h1 className="h1 mt-1">Reservations</h1>
        </div>
        <p className="meta tabular-nums" aria-live="polite">
          {reservations.length} result{reservations.length !== 1 ? 's' : ''}
        </p>
      </div>

      <SearchInput defaultValue={q} />

      {reservations.length === 0 ? (
        <div className="card p-8 mt-6 text-center">
          <p className="meta">{q ? 'No reservations match that search.' : 'No reservations yet.'}</p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {reservations.map(r => <ReservationRow key={r.id} reservation={r} />)}
        </ul>
      )}
    </div>
  )
}
