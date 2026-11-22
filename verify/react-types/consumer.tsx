// A host compiling against the shipped declarations: every ref the entry takes, filled from useRef(null).
import React from 'react'
import { FilterBar, GraphView, createTaxonomy, initialFilter, useHostTheme } from '@jmbarzee/force-graph'
import type { Graph, GraphViewHandle } from '@jmbarzee/force-graph'

const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [], filterAxes: [] })
const graph: Graph = { nodes: [], edges: [] }

export function Host() {
  const view = React.useRef<GraphViewHandle>(null)
  const search = React.useRef<HTMLInputElement>(null)
  const root = React.useRef<HTMLDivElement>(null)
  const [filter, setFilter] = React.useState(() => initialFilter(taxonomy, graph))
  useHostTheme(root)
  return (
    <div ref={root}>
      <FilterBar graph={graph} taxonomy={taxonomy} filter={filter} onFilterChange={setFilter} searchInputRef={search} />
      <GraphView ref={view} graph={graph} taxonomy={taxonomy} />
    </div>
  )
}
