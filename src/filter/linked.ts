// The linked-views reducer: what a switch between two views does to their
// filters. Pure, so a host that keeps its own state can call it.

import type { AxisId } from '../graph/axis'
import type { Graph } from '../graph/model'
import type { Taxonomy } from '../graph/taxonomy'
import { reconcileFilter } from './reconcile'
import type { AxisLocks, FilterState, ReconcileResult, ViewTransition } from './types'

/** One view's share of the linked state. */
export interface LinkedViewState {
  /** The view's selections. */
  filter: FilterState
  /** The axes the view holds against adoption. */
  locks: AxisLocks
  /** The axes this view shows, in order — the ones a switch reconciles. */
  axes: readonly AxisId[]
  /** The locks the last switch into this view overrode, under a key each change of them bumps: a bar flashes the locks once per key; a manual switch overrides none. */
  overriddenLocks: { axes: ReadonlySet<AxisId>; key: number }
}

/** The overrides every view starts from, so an unchanged state keeps its identity. */
export const NO_OVERRIDES: LinkedViewState['overriddenLocks'] = { axes: new Set(), key: 0 }

/**
 * Switch to `to` from `from`: on a manual switch `to` adopts `from`'s
 * selections on the axes it shows, except where locked; on a focus `to`
 * widens just enough to show the target — to the whole chip holding its
 * value when `graph` is given — overriding locks (recorded). The same state
 * object comes back when nothing changed.
 */
export function linkedSwitch<V extends string>(
  state: Readonly<Record<V, LinkedViewState>>,
  taxonomy: Pick<Taxonomy, 'axisFor'>,
  to: V,
  from: V,
  transition: ViewTransition,
  graph?: Pick<Graph, 'nodes'>,
): { state: Readonly<Record<V, LinkedViewState>>; result: ReconcileResult } {
  const dest = state[to]
  const result = reconcileFilter({
    destination: dest.filter,
    source: state[from].filter,
    locks: dest.locks,
    transition,
    taxonomy,
    axes: dest.axes,
    graph,
  })
  const prev = dest.overriddenLocks
  const overridden = result.overriddenLocks.size === 0 && prev.axes.size === 0 ? prev : { axes: result.overriddenLocks, key: prev.key + 1 }
  if (result.filter === dest.filter && overridden === prev) return { state, result }
  return { state: { ...state, [to]: { ...dest, filter: result.filter, overriddenLocks: overridden } }, result }
}
