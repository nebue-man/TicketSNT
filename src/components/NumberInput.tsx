'use client'

import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'

/** While typing: the number the text means, or null if it isn't a whole number in range yet. */
export function parseWholeNumber(text: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text.trim())
  return n >= min && n <= max ? n : null
}

/** On leaving the field: clamp into range, or fall back to the last good value if it's empty or not a number. */
export function settleWholeNumber(text: string, fallback: number, min: number, max: number): number {
  if (!/^\d+$/.test(text.trim())) return fallback
  return Math.min(max, Math.max(min, Number(text.trim())))
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
}

/**
 * A whole-number field that can be cleared while typing. The parent only ever
 * sees valid numbers; when the field loses focus, an empty or out-of-range entry
 * snaps to the last valid value or the nearest limit.
 */
export function NumberInput({ value, onChange, min = 0, max = Number.MAX_SAFE_INTEGER, onBlur, ...rest }: Props) {
  const [text, setText] = useState(String(value))
  const [shown, setShown] = useState(value)
  // The parent changed the value (e.g. a form reset): show it.
  if (value !== shown) {
    setShown(value)
    setText(String(value))
  }

  return (
    <input
      {...rest}
      type="number"
      inputMode="numeric"
      min={min}
      max={max === Number.MAX_SAFE_INTEGER ? undefined : max}
      value={text}
      onChange={e => {
        setText(e.target.value)
        const n = parseWholeNumber(e.target.value, min, max)
        if (n !== null && n !== value) {
          setShown(n)
          onChange(n)
        }
      }}
      onBlur={e => {
        const n = settleWholeNumber(text, value, min, max)
        setText(String(n))
        if (n !== value) {
          setShown(n)
          onChange(n)
        }
        onBlur?.(e)
      }}
    />
  )
}
