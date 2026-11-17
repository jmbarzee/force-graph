// Where the nodes came to rest, kept across a reload: `onSettled` writes it,
// and `defaultPositions` hands it back, so the view opens where it settled.

import type { Position } from '@jmbarzee/force-graph'

const KEY = 'course-catalog.positions'

type Store = Pick<Storage, 'getItem' | 'setItem'>

/** Keep the positions the view settled on. */
export function savePositions(store: Store, positions: ReadonlyMap<string, Position>): void {
  store.setItem(KEY, JSON.stringify([...positions]))
}

/** The positions kept last, or undefined when none were or they do not parse. */
export function loadPositions(store: Store): Map<string, Position> | undefined {
  const kept = store.getItem(KEY)
  if (kept === null) return undefined
  try {
    return new Map(JSON.parse(kept) as [string, Position][])
  } catch {
    return undefined
  }
}
