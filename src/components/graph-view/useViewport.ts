// useViewport — the camera concern for the Graph View.
//
// Owns the viewport (pan/zoom transform, which follows a pane resize), the
// DOM container ref used to measure the canvas and the overlay ref that
// covers its top, and every framing: `requestFrame` takes a `FrameRequest` and
// frames it now or holds it for the physics loop's `tickFrame`. The keyboard
// handlers zoom about the centre of `containerRef`.

import React from 'react'
import { DEFAULT_VIEWPORT, followResize } from '../../graph/viewport'
import type { PaneSize, Viewport } from '../../graph/viewport'
import type { SimNode } from '../../graph/simulation'
import { frameView } from './frame'
import type { FrameRequest } from './frame'

export interface ViewportController {
  viewport: Viewport
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>
  containerRef: React.RefObject<HTMLDivElement>
  overlayRef: React.RefObject<HTMLDivElement>
  requestFrame: (request: FrameRequest) => void
  // Frame what `requestFrame` held, as the layout's alpha allows; the loop calls it each tick.
  tickFrame: (alpha: number) => void
}

/** The camera, framing the nodes `drawn` holds. */
export function useViewport(drawn: React.RefObject<readonly SimNode[]>): ViewportController {
  const [viewport, setViewport] = React.useState<Viewport>(DEFAULT_VIEWPORT)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const overlayRef = React.useRef<HTMLDivElement>(null)

  // A resize keeps the world point at the pane's centre fixed. The shift is
  // the change since the size the viewport was last computed for: `measure()`
  // records that size, so a viewport framed after the host resized the pane,
  // but before the observer ran, is not shifted again. `followResize` leaves
  // the first measurement and a zero-sized (hidden) pane alone.
  const sizeRef = React.useRef<PaneSize | null>(null)
  const measure = React.useCallback(() => {
    const container = containerRef.current
    if (!container) return null
    const { width, height } = container.getBoundingClientRect()
    sizeRef.current = { width, height }
    return { width, height }
  }, [])
  React.useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => {
      const prev = sizeRef.current
      const size = measure()
      if (size) setViewport(vp => followResize(vp, prev, size))
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [measure])

  // Whether the pane measured something to frame in: a hidden one does not.
  const apply = React.useCallback((request: FrameRequest): boolean => {
    const size = measure()
    if (!size?.width || !size.height) return false
    const area = { ...size, top: overlayRef.current?.getBoundingClientRect().height ?? 0 }
    setViewport(vp => frameView(vp, request, drawn.current ?? [], area))
    return true
  }, [measure, drawn])

  // A warm request waits for a measured pane; the others act once, framed or not.
  const held = React.useRef<{ warm?: FrameRequest; next?: FrameRequest }>({})
  const requestFrame = React.useCallback((request: FrameRequest) => {
    const when = request.when ?? 'now'
    if (when !== 'now') { held.current[when] = request; return }
    apply(request)
    request.then?.()
  }, [apply])
  const tickFrame = React.useCallback((alpha: number) => {
    const { warm, next } = held.current
    if (warm) {
      if (alpha >= 0.3 || !apply(warm)) return
      held.current.warm = undefined
      warm.then?.()
    }
    if (next) {
      held.current.next = undefined
      apply(next)
      next.then?.()
    }
  }, [apply])

  return { viewport, setViewport, containerRef, overlayRef, requestFrame, tickFrame }
}
