import React from 'react'
import { createRoot } from 'react-dom/client'
import { GraphView, createTaxonomy, themeChoiceOf } from '@jmbarzee/force-graph'
import type { Graph } from '@jmbarzee/force-graph'
import './brand.css'

const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [
    { id: 'harbour', label: 'Harbour', icon: '⚓', summaryKind: 'children',
      color: { light: { fill: '#0B4F6C', border: '#062F40' }, dark: { fill: '#5FB3D4', border: '#0B4F6C' } }, size: { r: 18 } },
    { id: 'berth', label: 'Berth', icon: '▬',
      color: { light: { fill: '#E4572E', border: '#9C3415' }, dark: { fill: '#F08A6C', border: '#E4572E' } } },
  ],
  edgeTypes: [
    { id: 'in', sourceValue: 'berth', targetValue: 'harbour', relation: 'containment' },
    { id: 'ferry', sourceValue: 'berth', targetValue: 'berth', relation: 'dependency' },
  ],
})

const graph: Graph = {
  nodes: [
    { id: 'north', name: 'North Harbour', values: { kind: 'harbour' } },
    { id: 'n1', name: 'Berth 1', values: { kind: 'berth' }, parentId: 'north' },
    { id: 'n2', name: 'Berth 2', values: { kind: 'berth' }, parentId: 'north' },
    { id: 'south', name: 'South Harbour', values: { kind: 'harbour' } },
    { id: 's1', name: 'Berth 3', values: { kind: 'berth' }, parentId: 'south' },
  ],
  edges: [{ id: 'n2→s1', sourceId: 'n2', targetId: 's1' }],
}

// `?theme=dark` (or `light`) starts the pane in that theme.
const defaultTheme = themeChoiceOf(new URLSearchParams(location.search).get('theme'))

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GraphView graph={graph} taxonomy={taxonomy} className="brand" defaultTheme={defaultTheme} />
  </React.StrictMode>,
)
