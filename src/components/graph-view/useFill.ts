// The fill seam for components: the view provides the fill it resolved, so
// the canvas, the chips, the control rows and the hover box read one answer.

import React from 'react'
import { fillOf } from '../../graph/coloring'
import type { Fill } from '../../graph/coloring'
import type { Taxonomy } from '../../graph/taxonomy'

/** The fill a view resolved, for every reader inside it. */
export const FillContext = React.createContext<Fill | null>(null)

const NO_GRAPH = { nodes: [], edges: [] }

/** The fill in scope; with no view above, as for a standalone bar, the style axis's. */
export function useFill(taxonomy: Taxonomy): Fill {
  const provided = React.useContext(FillContext)
  const own = React.useMemo(() => (provided ? null : fillOf(undefined, NO_GRAPH, taxonomy)), [provided, taxonomy])
  return provided ?? own!
}
