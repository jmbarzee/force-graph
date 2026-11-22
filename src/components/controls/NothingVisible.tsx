import React from 'react'
import type { FilterState } from '../../filter/types'
import { passesGroups } from '../../filter/types'
import { useStrings } from '../graph-view/strings'
import './controls.css'

/** The control a force tab names when nothing is visible: the legend's groups, or else the filter bar's chips. */
export type HiddenBy = 'legend' | 'chips'

/** The legend when its group filter alone hides every node, named first when the chips do too. */
export function hiddenByOf(
  nodes: readonly { id: string }[],
  filter: FilterState,
  groupsOf: ReadonlyMap<string, readonly string[]>,
): HiddenBy {
  return nodes.length > 0 && !nodes.some(n => passesGroups(filter, groupsOf.get(n.id) ?? [])) ? 'legend' : 'chips'
}

export const HiddenByContext = React.createContext<HiddenBy>('chips')

export function NothingVisible() {
  const s = useStrings()
  return <p className="gv-ctl-nothing-visible">{React.useContext(HiddenByContext) === 'legend' ? s.nothingVisibleLegend : s.nothingVisibleChips}</p>
}
