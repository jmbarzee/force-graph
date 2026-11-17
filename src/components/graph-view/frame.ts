// A framing request and the viewport it asks for.

import type { PaneSize, Viewport } from '../../graph/viewport'
import type { SimNode } from '../../graph/simulation'

/**
 * A framing, handed to the camera's one owner, `useViewport`'s
 * `requestFrame`: the nodes to bring into view. Only the drawn ones among
 * `ids` count, and a request naming none, or framing them less than half a
 * pixel from where they are, leaves the viewport as it is. The
 * frame fits them `padding` px inside the canvas below the overlay, or,
 * given `minScale`, centres them there at the current scale raised to it.
 *
 * It frames at once, or when `when` says: `'warm'`, the first loop tick the
 * layout has cooled below alpha 0.3; `'next'`, the loop's next tick after any
 * warm one. A waiting request replaces the one waiting for the same `when`.
 * One that `hold`s re-frames each tick after it acts, until a user's pan,
 * zoom or drag, a newer request or a settled layout releases it, and
 * `released` runs then, unless for a newer request. A release, or a newer
 * request, also drops a waiting `hold` request, which then never acts, but a
 * `'warm'` request leaves a waiting `'next'` one, which acts after it. A
 * release keeps a `'warm'` request the layout has cooled for and only the
 * pane holds up: it frames once, when the pane measures.
 */
export interface FrameRequest {
  ids: Iterable<string>
  padding?: number
  minScale?: number
  when?: 'warm' | 'next'
  hold?: boolean
  released?: () => void
}

/**
 * The requests the camera's owner waits on and holds. `apply` frames one, and
 * says whether the pane measured something to frame in: a warm request waits
 * for one, and the others act once, framed or not.
 */
export function frameQueue(apply: (request: FrameRequest) => boolean) {
  let warm: FrameRequest | undefined, next: FrameRequest | undefined, held: FrameRequest | undefined
  let cooled = false
  const act = (request: FrameRequest) => {
    held = request.hold ? request : undefined
  }
  const drop = () => {
    if (warm?.hold) warm = undefined
    if (next?.hold) next = undefined
    held = undefined
  }
  // A warm request acts once the layout has cooled and the pane measured.
  const landWarm = () => {
    if (!warm || !cooled || !apply(warm)) return false
    const request = warm
    warm = undefined
    act(request)
    return true
  }
  return {
    request(request: FrameRequest) {
      const behind = request.when === 'warm' ? next : undefined
      drop()
      next ??= behind
      if (request.when === 'warm') { warm = request; cooled = false }
      else if (request.when === 'next') next = request
      else { apply(request); act(request) }
    },
    tick(alpha: number) {
      cooled = alpha < 0.3
      if (held) apply(held)
      if (warm && !landWarm()) return
      if (next) {
        const request = next
        next = undefined
        apply(request)
        act(request)
      }
    },
    // The pane measured: a warm request it alone held up acts now.
    measured() {
      landWarm()
    },
    release() {
      const released = held?.released
      const waiting = cooled && warm ? { ...warm, hold: false } : undefined
      drop()
      warm ??= waiting
      released?.()
    },
  }
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
  const x = area.width / 2 - (minX + maxX) / 2 * scale
  const y = area.overlay + height / 2 - (minY + maxY) / 2 * scale
  const ds = scale - vp.scale
  const moved = Math.max(
    Math.abs(x - vp.x + ds * minX), Math.abs(x - vp.x + ds * maxX),
    Math.abs(y - vp.y + ds * minY), Math.abs(y - vp.y + ds * maxY),
  )
  return moved < 0.5 ? vp : { scale, x, y }
}
