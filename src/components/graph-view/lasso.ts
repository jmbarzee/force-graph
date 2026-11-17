import { worldToScreen } from '../../graph/viewport'
import type { Viewport } from '../../graph/viewport'

export type Point = { x: number; y: number }

/** The ids of the nodes whose centres the closed screen polygon `path` encloses, in node order. */
export function lassoed(path: readonly Point[], nodes: readonly (Point & { id: string })[], vp: Viewport): string[] {
  return nodes.filter(n => encloses(path, ...worldToScreen(vp, n.x, n.y))).map(n => n.id)
}

// Even-odd ray cast: a ray rightward from the point crosses the edges an odd number of times.
function encloses(path: readonly Point[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const a = path[i]!, b = path[j]!
    if ((a.y > y) !== (b.y > y) && x < a.x + ((y - a.y) / (b.y - a.y)) * (b.x - a.x)) inside = !inside
  }
  return inside
}
