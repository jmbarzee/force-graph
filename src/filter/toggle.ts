// The chip-toggle reducers behind the shared filter bar.
//
// Pure, and deliberately outside the component. Each reducer rebuilds only the
// selection for the axis it edits, of the kind it was — on an exclusion a
// value turned off joins `except` and one turned on leaves it; every other
// axis is passed through by reference, which `withSelection` guarantees, so a
// no-op edit changes no identity and the view's memos have nothing to
// recompute.

import type { AxisId } from '../graph/axis'
import type { FilterState } from './types'
import { selectionFor, selects, withSelection, withValues } from './types'

/** Toggle one value on one axis. */
export function toggleValue(
  filter: FilterState,
  axis: AxisId,
  value: string,
): FilterState {
  const current = selectionFor(filter, axis)
  return withSelection(filter, axis, withValues(current, [value], !selects(current, value)))
}

/**
 * Toggle a group of values on one axis as a unit.
 *
 * A chip may cover several values — one covers three. "Any on" turns the whole
 * group off; otherwise the whole group goes on, so a partially-on group has a
 * single unambiguous next state.
 */
export function toggleGroup(
  filter: FilterState,
  axis: AxisId,
  values: readonly string[],
): FilterState {
  const current = selectionFor(filter, axis)
  return withSelection(filter, axis, withValues(current, values, !values.some(v => selects(current, v))))
}
