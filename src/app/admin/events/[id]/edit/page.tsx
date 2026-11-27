import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAdminEvent } from '@/lib/data/admin/events'
import { requireAuth } from '@/lib/auth'
import EditEventForm from './EditEventForm'

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAuth('admin')
  const { id } = await params
  const event = await getAdminEvent(id)
  if (!event) notFound()

  return (
    <div className="max-w-[640px]">
      <div className="mb-8">
        <Link href={`/admin/events/${id}`} className="navlink">← {event.name}</Link>
        <h1 className="h1 mt-1">Edit event</h1>
      </div>
      <EditEventForm event={event} />
    </div>
  )
}
