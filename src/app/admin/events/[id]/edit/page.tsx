import { notFound } from 'next/navigation'
import { getAdminEvent } from '@/lib/data/admin/events'
import { requireAuth } from '@/lib/auth'
import EditEventForm from './EditEventForm'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const event = await getAdminEvent(id)
  if (!event) notFound()

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-bone-white font-normal" style={{ fontSize: '28px', letterSpacing: '-0.02em' }}>
          Edit event
        </h1>
        <p className="text-ash-gray font-light mt-1" style={{ fontSize: '14px' }}>
          {event.name}
        </p>
      </div>
      <EditEventForm event={event} />
    </div>
  )
}
