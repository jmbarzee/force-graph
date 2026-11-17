// A framing request and the viewport it asks for.

import { MIN_ZOOM } from '../../graph/viewport'
import type { PaneSize, Viewport } from '../../graph/viewport'
import type { SimNode } from '../../graph/simulation'

/**
 * A framing, handed to the camera's one owner, `useViewport`'s
 * `requestFrame`: the nodes to bring into view. Only the drawn ones among
 * `ids` count, and a request naming none leaves the viewport as it is. The
 * frame fits them `padding` px inside the canvas below the overlay, or,
 * given `minScale`, centres them there at the current scale raised to it.
 *
 * `when` is `'now'` (the default); `'warm'`, the first loop tick the layout
 * has cooled below alpha 0.3; or `'next'`, the loop's next tick after any
 * warm one. A held request replaces the one held for the same `when`, and
 * `then` runs when the owner acts on it.
 */
export interface FrameRequest {
  ids: Iterable<string>
  padding?: number
  minScale?: number
  when?: 'now' | 'warm' | 'next'
  then?: () => void
}

/** The pane, of which the overlay covers the `top` px. */
export interface FrameArea extends PaneSize {
  top: number
}

/** The viewport that frames `request`'s drawn nodes inside `area`, or `vp` when it names none. */
export function frameView(vp: Viewport, request: FrameRequest, drawn: readonly SimNode[], area: FrameArea): Viewport {
  const ids = new Set(request.ids)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of drawn) {
    if (!ids.has(n.id)) continue
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
  }
  if (minX === Infinity) return vp

  const height = area.height - area.top
  const padding = request.padding ?? 60
  const scale = request.minScale !== undefined
    ? Math.max(vp.scale, request.minScale)
    : Math.max(MIN_ZOOM, Math.min((area.width - padding * 2) / (maxX - minX || 1), (height - padding * 2) / (maxY - minY || 1), 2))
  return {
    scale,
    x: area.width / 2 - (minX + maxX) / 2 * scale,
    y: area.top + height / 2 - (minY + maxY) / 2 * scale,
  }
}
