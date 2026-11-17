import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PushPullControls } from '../PushPullControls'
import { GravityControls } from '../GravityControls'
import { TaxonomyContext } from '../graph-view/useTaxonomy'
import { computeVisibleGraph } from '../graph-view/visibleGraph'
import { presentSetsOf } from '../graph-view/present'
import { createTaxonomy } from '../../graph/taxonomy'
import { resolvePhysics } from '../../graph/forces'
import { axisOptions, defaultParamsFor, layoutAxisOptions, sprungEdges } from '../../graph/simulation'
import type { SimNode } from '../../graph/simulation'
import { initialFilter, withSelection } from '../../filter/types'
import type { NodeStyle } from '../../graph/shapes'
import type { Graph, GraphNode } from '../../graph/model'

const LINE = 'Nothing visible on this axis — turn a chip on.'

const style = (id: string): NodeStyle => ({
  id, label: id, icon: id, abbreviation: id,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
  size: { r: 10, iconSize: 10 },
})
const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [style('parent'), style('child')],
  edgeTypes: [{ id: 'within', sourceValue: 'child', targetValue: 'parent', relation: 'containment' }],
})
const node = (id: string, kind: string, parentId?: string): GraphNode => ({ id, name: id, values: { kind }, parentId })
const graph: Graph = {
  nodes: [node('p', 'parent'), node('c', 'child', 'p')],
  edges: [{ id: 'in', sourceId: 'c', targetId: 'p', relation: 'containment' }],
}
const nodes = graph.nodes as SimNode[]
const getNode = (id: string) => nodes.find(n => n.id === id)
const params = defaultParamsFor(taxonomy)
const resolved = resolvePhysics(params, taxonomy)
const axes = axisOptions(taxonomy, graph)
const noop = () => {}

/** Both force tabs, rendered over what `styles` leaves visible. */
function forceTabs(styles: string[]): string {
  const filter = withSelection(initialFilter(taxonomy, graph), 'kind', new Set(styles))
  const { visibleNodes, visibleIds } = computeVisibleGraph({ nodes, edges: graph.edges, getNode }, filter, taxonomy)
  const present = presentSetsOf(visibleNodes, sprungEdges(graph.edges, visibleIds), resolved, getNode)
  return renderToStaticMarkup(React.createElement(TaxonomyContext.Provider, { value: taxonomy },
    React.createElement(PushPullControls, {
      params, resolved, axes, present, onParamChange: noop, onAxisChange: noop, onActiveSection: noop,
      hoveredPushBucket: null, onHoverPushBucket: noop, hoveredEdge: null, onHoverEdge: noop,
    }),
    React.createElement(GravityControls, {
      params, resolved, axes: layoutAxisOptions(axes, taxonomy), present,
      onParamChange: noop, onRelayout: noop, hovered: null, onHover: noop,
    }),
  ))
}
const count = (html: string, s: string) => html.split(s).length - 1
const EQUATION = 'gv-graph-control-equation-formula'
const SLIDER = 'type="range"'

describe('a force tab over an empty visible set', () => {
  const empty = forceTabs([])
  const full = forceTabs(['parent', 'child'])

  it('says why in place of the push and pull maps and each axis plot', () => {
    expect(count(empty, LINE)).toBe(4)
  })

  it('keeps every equation and every slider', () => {
    expect(count(empty, EQUATION)).toBe(count(full, EQUATION))
    expect(count(empty, SLIDER)).toBe(count(full, SLIDER))
  })

  it('draws the maps and plots while anything is visible', () => {
    expect(count(full, LINE)).toBe(0)
  })
})
