import React from 'react'
import { createRoot } from 'react-dom/client'
import { FilterBar, GraphView, createTaxonomy, initialFilter } from '@jmbarzee/force-graph'
import type { Graph } from '@jmbarzee/force-graph'

const AXES = ['Region', 'Team', 'Product', 'Language', 'Week']
const VALUES = 30

const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [{
    id: 'item',
    label: 'Item',
    icon: '•',
    abbreviation: 'It',
    color: { light: { fill: '#2563EB', border: '#1E3A8A' }, dark: { fill: '#60A5FA', border: '#1D4ED8' } },
    size: { r: 8, iconSize: 9 },
  }],
  // One axis wears tags, so both presentations are measured.
  filterAxes: AXES.map((id, k) => ({ id, emptyMeans: 'all', presentation: k === 0 ? 'tag' : 'chip' })),
})

// Every node takes a value on every axis, so each axis presents all thirty.
const graph: Graph = {
  nodes: Array.from({ length: 120 }, (_, i) => ({
    id: `n${i}`,
    name: `Item ${i}`,
    values: Object.fromEntries([['kind', 'item'], ...AXES.map((axis, k) => [axis, `${axis} ${(i + 7 * k) % VALUES + 1}`])]),
  })),
  edges: [],
}

function App() {
  const [shown, setShown] = React.useState(false)
  const [filter, setFilter] = React.useState(() => initialFilter(taxonomy, graph))
  return (
    <>
      <button onClick={() => setShown(!shown)}>{shown ? 'Hide' : 'Show'} the second bar</button>
      <div style={{ display: shown ? 'block' : 'none' }}>
        <FilterBar graph={graph} taxonomy={taxonomy} filter={filter} onFilterChange={setFilter} />
      </div>
      <GraphView graph={graph} taxonomy={taxonomy} />
    </>
  )
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
