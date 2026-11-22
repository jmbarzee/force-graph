// A framing request and the viewport it asks for.

import type { PaneSize, Viewport } from '../../graph/viewport'
import type { SimNode } from '../../graph/simulation'

/**
 * A framing, handed to the camera's one owner, `useViewport`'s
 * `requestFrame`: the nodes to bring into view. Only the drawn ones among
 * `ids` count, and a request naming none, or framing them less than half a
 * pixel from where they are, leaves the viewport as it is. The
 * frame fits them `padding` px inside the canvas the pane's chrome leaves
 * clear, or, given `minScale`, centres them there at the current scale raised
 * to it.
 *
 * It frames at once, or when `when` says: `'drawn'`, once the pane measured
 * and one of its ids drew, however hot the layout; `'next'`, the loop's next
 * tick after any drawn one. A waiting request replaces the one waiting for
 * the same `when`.
 * One that `hold`s re-frames each tick after it acts, until a user's pan,
 * zoom or drag, a newer request or a settled layout releases it, and
 * `released` runs then, unless for a newer request. A release, or a newer
 * request, also drops a waiting `hold` request, which then never acts, but a
 * `'drawn'` request leaves a waiting `'next'` one, which acts after it. A
 * user's release drops any waiting `'drawn'` request, and a settled layout
 * keeps one: it frames once, when it can.
 */
export interface FrameRequest {
  ids: Iterable<string>
  padding?: number
  minScale?: number
  when?: 'drawn' | 'next'
  hold?: boolean
  released?: () => void
}

/**
 * The requests the camera's owner waits on and holds. `apply` frames one, and
 * says whether the pane measured and drew one of its ids: a drawn request
 * waits for that, and the others act once, framed or not.
 */
export function frameQueue(apply: (request: FrameRequest) => boolean) {
  let pending: FrameRequest | undefined, next: FrameRequest | undefined, held: FrameRequest | undefined
  const act = (request: FrameRequest) => {
    held = request.hold ? request : undefined
  }
  const drop = () => {
    if (pending?.hold) pending = undefined
    if (next?.hold) next = undefined
    held = undefined
  }
  const release = () => {
    const released = held?.released
    drop()
    pending = undefined
    released?.()
  }
  const land = () => {
    if (!pending || !apply(pending)) return false
    const request = pending
    pending = undefined
    act(request)
    return true
  }
  return {
    request(request: FrameRequest) {
      const behind = request.when === 'drawn' ? next : undefined
      drop()
      next ??= behind
      if (request.when === 'drawn') pending = request
      else if (request.when === 'next') next = request
      else { apply(request); act(request) }
    },
    tick() {
      if (held) apply(held)
      if (pending && !land()) return
      if (next) {
        const request = next
        next = undefined
        apply(request)
        act(request)
      }
    },
    retry: land,
    release,
    settle() {
      const waiting = pending && { ...pending, hold: false }
      release()
      pending = waiting
    },
  }
}

/** How far the pane's chrome reaches in from each side; a frame lies inside what it leaves clear. */
export interface Insets { top: number; right: number; bottom: number; left: number }

/**
 * The insets that clear each of `chrome`, rects relative to the pane. Each is
 * cleared from the side that gives up the least canvas: the filter bar from the
 * top, the scrubber from the bottom, a tall legend at the left from the left.
 */
export function chromeInsets(pane: PaneSize, chrome: Iterable<{ left: number; top: number; right: number; bottom: number }>): Insets {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 }
  for (const r of chrome) {
    if (r.right <= 0 || r.bottom <= 0 || r.left >= pane.width || r.top >= pane.height || r.right <= r.left || r.bottom <= r.top) continue
    const reach = { top: r.bottom, right: pane.width - r.left, bottom: pane.height - r.top, left: r.right }
    const cost = { top: reach.top * pane.width, right: reach.right * pane.height, bottom: reach.bottom * pane.width, left: reach.left * pane.height }
    const side = (Object.keys(cost) as (keyof Insets)[]).reduce((a, b) => (cost[b] < cost[a] ? b : a))
    insets[side] = Math.max(insets[side], reach[side])
  }
  return insets
}

export function frameView(vp: Viewport, request: FrameRequest, drawn: readonly SimNode[], area: PaneSize & { insets: Insets }): Viewport {
  const ids = new Set(request.ids)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const n of drawn) {
    if (!ids.has(n.id)) continue
    minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x)
    minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y)
  }
  if (minX === Infinity) return vp

  const padding = request.padding ?? 60
  // An axis its insets leave less than twice the padding is framed across the whole pane.
  const clear = (span: number, a: number, b: number) => (span - a - b > padding * 2 ? [a, span - a - b] : [0, span])
  const [left, width] = clear(area.width, area.insets.left, area.insets.right)
  const [top, height] = clear(area.height, area.insets.top, area.insets.bottom)
  const scale = request.minScale !== undefined
    ? Math.max(vp.scale, request.minScale)
    : Math.min((width - padding * 2) / (maxX - minX || 1), (height - padding * 2) / (maxY - minY || 1), 2)
  const x = left + width / 2 - (minX + maxX) / 2 * scale
  const y = top + height / 2 - (minY + maxY) / 2 * scale
  const ds = scale - vp.scale
  const moved = Math.max(
    Math.abs(x - vp.x + ds * minX), Math.abs(x - vp.x + ds * maxX),
    Math.abs(y - vp.y + ds * minY), Math.abs(y - vp.y + ds * maxY),
  )
  return moved < 0.5 ? vp : { scale, x, y }
}
