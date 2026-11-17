// useViewport — the camera concern for the Graph View.
//
// Owns the viewport, which follows a pane resize, and every framing: each
// lands in the canvas below the overlay.

import React from 'react'
import { DEFAULT_VIEWPORT, followResize } from '../../graph/viewport'
import type { PaneSize, Viewport } from '../../graph/viewport'
import type { SimNode } from '../../graph/simulation'
import { frameView } from './frame'
import { useLatest } from './useControllable'
import { useIsomorphicLayoutEffect } from './useIsomorphicLayoutEffect'
import type { FrameRequest } from './frame'

export interface ViewportController {
  viewport: Viewport
  setViewport: React.Dispatch<React.SetStateAction<Viewport>>
  containerRef: React.RefObject<HTMLDivElement>
  overlayRef: React.RefObject<HTMLDivElement>
  overlayHeight: number
  requestFrame: (request: FrameRequest) => void
  // Frame what `requestFrame` held, as the layout's alpha allows; the loop calls it each tick.
  tickFrame: (alpha: number) => void
}

/** The camera, framing the nodes `drawn` holds. */
export function useViewport(drawn: React.RefObject<readonly SimNode[]>): ViewportController {
  const [viewport, setViewport] = React.useState<Viewport>(DEFAULT_VIEWPORT)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const overlayRef = React.useRef<HTMLDivElement>(null)

  // The overlay (filter chips, search, the host's findings, the pane's
  // diagnostics, the search results) floats over the full-bleed canvas, and
  // its height is dynamic. It is measured whole, so a frame and a host control
  // anchored at `--gv-toolbar-height` sit under everything it shows, the open
  // search results included.
  const [overlayHeight, setOverlayHeight] = React.useState(0)
  const overlayHeightRef = useLatest(overlayHeight)
  useIsomorphicLayoutEffect(() => {
    const el = overlayRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const update = () => setOverlayHeight(el.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

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
    const area = { ...size, overlay: overlayHeightRef.current }
    setViewport(vp => frameView(vp, request, drawn.current ?? [], area))
    return true
  }, [measure, drawn, overlayHeightRef])

  // A warm request waits for a measured pane; the others act once, framed or not.
  const held = React.useRef<{ warm?: FrameRequest; next?: FrameRequest }>({})
  const requestFrame = React.useCallback((request: FrameRequest) => {
    if (request.when) { held.current[request.when] = request; return }
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

  return { viewport, setViewport, containerRef, overlayRef, overlayHeight, requestFrame, tickFrame }
}
