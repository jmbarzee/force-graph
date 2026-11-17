// A framing request and the viewport it asks for.

import type { PaneSize, Viewport } from '../../graph/viewport'
import type { SimNode } from '../../graph/simulation'

/**
 * A framing, handed to the camera's one owner, `useViewport`'s
 * `requestFrame`: the nodes to bring into view. Only the drawn ones among
 * `ids` count, and a request naming none leaves the viewport as it is. The
 * frame fits them `padding` px inside the canvas below the overlay, or,
 * given `minScale`, centres them there at the current scale raised to it.
 *
 * It frames at once, or when `when` says: `'warm'`, the first loop tick the
 * layout has cooled below alpha 0.3; `'next'`, the loop's next tick after any
 * warm one. A held request replaces the one held for the same `when`, and
 * `then` runs when the owner acts on it.
 */
export interface FrameRequest {
  ids: Iterable<string>
  padding?: number
  minScale?: number
  when?: 'warm' | 'next'
  then?: () => void
}

export function frameView(vp: Viewport, request: FrameRequest, drawn: readonly SimNode[], area: PaneSize & { overlay: number }): Viewport {
  const ids = new Set(request.ids)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of drawn) {
    if (!ids.has(n.id)) continue
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
  }
  if (minX === Infinity) return vp

  const height = area.height - area.overlay
  const padding = request.padding ?? 60
  const scale = request.minScale !== undefined
    ? Math.max(vp.scale, request.minScale)
    : Math.min((area.width - padding * 2) / (maxX - minX || 1), (height - padding * 2) / (maxY - minY || 1), 2)
  return {
    scale,
    x: area.width / 2 - (minX + maxX) / 2 * scale,
    y: area.overlay + height / 2 - (minY + maxY) / 2 * scale,
  }
}
