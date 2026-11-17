// Viewport transform for the graph canvas.
// Converts between world coordinates (node positions) and screen coordinates (canvas pixels).

export interface Viewport {
  x: number     // translation (world offset) in screen pixels
  y: number
  scale: number // zoom level (1 = 100%)
}

export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, scale: 1 }

// Zoom bounds. The upper bound is generous so dense clusters can be spread far
// enough apart on screen to reveal every node's label (labels hide when they'd
// overlap a neighbour or its node — see GraphCanvas).
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 40

export function worldToScreen(vp: Viewport, wx: number, wy: number): [number, number] {
  return [wx * vp.scale + vp.x, wy * vp.scale + vp.y]
}

export function screenToWorld(vp: Viewport, sx: number, sy: number): [number, number] {
  return [(sx - vp.x) / vp.scale, (sy - vp.y) / vp.scale]
}

// Zoom centered on a screen point
export function zoomAt(vp: Viewport, sx: number, sy: number, factor: number): Viewport {
  const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, vp.scale * factor))
  // Adjust translation so the point under the cursor stays fixed
  const wx = (sx - vp.x) / vp.scale
  const wy = (sy - vp.y) / vp.scale
  return {
    scale: newScale,
    x: sx - wx * newScale,
    y: sy - wy * newScale,
  }
}

export interface PaneSize {
  width: number
  height: number
}

// Keep the world point under the pane's centre fixed across a resize from
// `prev` to `next`: the centre moves by half the size change, so the
// translation follows it. The first measurement (no `prev`) and a zero-sized
// pane on either side (hidden by its host) leave the camera where it is.
export function followResize(vp: Viewport, prev: PaneSize | null, next: PaneSize): Viewport {
  if (!prev?.width || !prev.height || !next.width || !next.height) return vp
  const dw = next.width - prev.width, dh = next.height - prev.height
  return dw || dh ? { ...vp, x: vp.x + dw / 2, y: vp.y + dh / 2 } : vp
}
