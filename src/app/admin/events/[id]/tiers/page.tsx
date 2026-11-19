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
      <div className="flex items-center justify-between mb-10">
        <div>
          <Link href={`/admin/events/${id}`}
            className="text-ash-gray hover:text-bone-white transition-colors font-light mb-3 block"
            style={{ fontSize: '13px' }}>
            ← {event.name}
          </Link>
          <h1 className="text-bone-white font-normal"
            style={{ fontSize: '28px', letterSpacing: '-0.02em' }}>
            Ticket tiers
          </h1>
        </div>
      </div>

      <TiersList tiers={tiers} eventId={id} />

      <div className="mt-10 pt-8 border-t border-[#1a1a1a]">
        <p className="text-ash-gray font-semibold uppercase mb-6"
          style={{ fontSize: '12px', letterSpacing: '0.35px' }}>
          Add tier
        </p>
        <AddTierForm eventId={id} existingSortOrder={tiers.length} />
      </div>
    </div>
  )
}
