import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAdminEvent } from '@/lib/data/admin/events'
import { getTiersForEvent } from '@/lib/data/admin/tiers'
import { TiersList } from '@/components/admin/TiersList'
import { AddTierForm } from '@/components/admin/AddTierForm'

export default async function TiersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [event, tiers] = await Promise.all([getAdminEvent(id), getTiersForEvent(id)])
  if (!event) notFound()

  return (
    <div>
      <div className="mb-8">
        <Link href={`/admin/events/${id}`} className="navlink">← {event.name}</Link>
        <h1 className="h1 mt-1">Ticket tiers</h1>
      </div>

      <TiersList tiers={tiers} eventId={id} />

      <section className="card p-6 mt-10 max-w-[600px]" aria-labelledby="add-tier-h">
        <h2 id="add-tier-h" className="h2 mb-6">Add a tier</h2>
        <AddTierForm eventId={id} existingSortOrder={tiers.length} />
      </section>
    </div>
  )
}
