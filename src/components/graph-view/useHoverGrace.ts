import React from 'react'

const HOVER_GRACE_MS = 150

/**
 * Hover with a grace period, so the pointer can travel onto a hover box
 * without it vanishing: `hover` sets a value at once and a null 150 ms after
 * the first null, however many follow; `hold` cancels a pending null, as the
 * box's onMouseEnter does.
 */
export function useHoverGrace<T>(set: (value: T | null) => void): { hover: (value: T | null) => void; hold: () => void } {
  const timer = React.useRef<number | null>(null)
  const hold = React.useCallback(() => {
    if (timer.current === null) return
    clearTimeout(timer.current)
    timer.current = null
  }, [])
  React.useEffect(() => hold, [hold])
  const hover = React.useCallback((value: T | null) => {
    if (value !== null) { hold(); set(value) }
    else if (timer.current === null) timer.current = window.setTimeout(() => { timer.current = null; set(null) }, HOVER_GRACE_MS)
  }, [hold, set])
  return { hover, hold }
}
