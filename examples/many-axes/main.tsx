// Five filter axes of thirty values each, on a graph with nothing else to
// show: the filter bar at its busiest, over the canvas it must leave in view.

import React from 'react'
import { createRoot } from 'react-dom/client'
import { GraphView, createTaxonomy } from '@jmbarzee/force-graph'
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
  filterAxes: AXES.map(id => ({ id, emptyMeans: 'all' })),
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

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GraphView graph={graph} taxonomy={taxonomy} />
  </React.StrictMode>,
)
