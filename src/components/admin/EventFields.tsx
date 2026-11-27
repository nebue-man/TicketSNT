'use client'

import { generatePin } from '@/lib/utils/generate-pin'
import { NumberInput } from '@/components/NumberInput'

export interface EventFieldValues {
  name: string
  dateTime: string
  venue: string
  description: string
  coverUrl: string
  maxPer: number
  pin: string
}

/** The fields shared by the New event and Edit event forms. */
export function EventFields({ values, onChange, placeholders = false }: {
  values: EventFieldValues
  onChange: (patch: Partial<EventFieldValues>) => void
  /** Show example placeholders (the New event form). */
  placeholders?: boolean
}) {
  return (
    <>
      <div className="field">
        <label htmlFor="event-name" className="label">Event name</label>
        <input id="event-name" required type="text" value={values.name}
          onChange={e => onChange({ name: e.target.value })}
          placeholder={placeholders ? 'e.g. SNT Exclusive Night' : undefined}
          className="input" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="event-date" className="label">Date and time</label>
          <input id="event-date" required type="datetime-local" value={values.dateTime}
            onChange={e => onChange({ dateTime: e.target.value })}
            className="input tabular-nums" />
        </div>
        <div className="field">
          <label htmlFor="event-venue" className="label">Venue</label>
          <input id="event-venue" required type="text" value={values.venue}
            onChange={e => onChange({ venue: e.target.value })}
            placeholder={placeholders ? 'e.g. Colombo Hilton' : undefined}
            className="input" />
        </div>
      </div>

      <div className="field">
        <label htmlFor="event-description" className="label">
          Description <span className="text-faint font-normal">(optional)</span>
        </label>
        <textarea id="event-description" rows={4} value={values.description}
          onChange={e => onChange({ description: e.target.value })}
          placeholder={placeholders ? 'A short description of the event' : undefined}
          className="input" />
      </div>

      <div className="field">
        <label htmlFor="event-cover" className="label">
          Cover image URL <span className="text-faint font-normal">(optional)</span>
        </label>
        <input id="event-cover" type="url" value={values.coverUrl}
          onChange={e => onChange({ coverUrl: e.target.value })}
          placeholder="https://…"
          className="input" />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="field">
          <label htmlFor="event-max" className="label">Max tickets per reservation</label>
          <NumberInput id="event-max" min={1} max={20} value={values.maxPer}
            onChange={maxPer => onChange({ maxPer })}
            className="input tabular-nums" />
        </div>
        <div className="field">
          <label htmlFor="event-pin" className="label">Gate PIN</label>
          <div className="flex gap-2">
            <input id="event-pin" required type="text" value={values.pin}
              onChange={e => onChange({ pin: e.target.value.toUpperCase() })}
              className="input mono flex-1 min-w-0 text-[18px] tracking-[0.15em]" />
            <button type="button" onClick={() => onChange({ pin: generatePin() })}
              className="btn btn-secondary shrink-0 h-12">
              New PIN
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

/** The publish switch: a labelled checkbox with role="switch". */
export function PublishSwitch({ checked, onChange, label, hint }: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <div>
      <label className="inline-flex items-center gap-3 cursor-pointer min-h-11">
        <input type="checkbox" role="switch" className="switch" checked={checked}
          onChange={e => onChange(e.target.checked)} />
        <span className="font-medium">{label}</span>
      </label>
      {hint && <p className="hint mt-1">{hint}</p>}
    </div>
  )
}
