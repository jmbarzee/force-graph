// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it } from 'vitest'
import { GraphView } from './GraphView'
import type { GraphViewHandle } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import type { Graph, GraphNode } from '../graph/model'
import type { FilterState } from '../filter/types'
import { selectionFor, withSelection } from '../filter/types'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

// Two allow-lists; `site` opens without `z`, which only the grown graph has, so a re-seed shows.
const taxonomy = createTaxonomy({
  styleAxis: 'kind', styles: [],
  filterAxes: [{ id: 'team', emptyMeans: 'none' }, { id: 'site', emptyMeans: 'none', initialSelection: values => values.filter(v => v !== 'z') }],
})
const graphOf = (...pairs: [string, string][]): Graph => ({ nodes: pairs.map(([team, site], i): GraphNode => ({ id: `n${i}`, name: team, values: { team, site } })), edges: [] })
const first = graphOf(['a', 'x'], ['b', 'y'])
const grown = graphOf(['a', 'x'], ['b', 'y'], ['c', 'z'])

/** Mount a view that keeps its filter, and the last filter it reported. */
async function mount(props: Partial<React.ComponentProps<typeof GraphView>>, start = first) {
  const ref = React.createRef<GraphViewHandle>()
  const reported: FilterState[] = []
  const root = createRoot(document.createElement('div'))
  const render = (graph: Graph) => act(async () => {
    root.render(React.createElement(GraphView, { ref, graph, taxonomy, onFilterChange: next => reported.push(next), ...props }))
  })
  await render(start)
  return { ref, render, last: () => reported[reported.length - 1]! }
}

it('writes one axis through updateFilter, and re-seeds the rest when the graph grows', async () => {
  const view = await mount({})
  await act(async () => view.ref.current!.updateFilter(f => withSelection(f, 'team', new Set(['a']))))
  expect(selectionFor(view.last(), 'team')).toEqual(new Set(['a']))
  await view.render(grown)
  expect(selectionFor(view.last(), 'team')).toEqual(new Set(['a']))
  expect(selectionFor(view.last(), 'site')).toEqual({ except: new Set(['z']) })
})

it('keeps the axes defaultFilter changed, and re-seeds the rest', async () => {
  const view = await mount({ defaultFilter: new Map([['team', { except: new Set(['a']) }], ['site', { except: new Set() }]]) }, graphOf())
  await view.render(grown)
  expect(selectionFor(view.last(), 'team')).toEqual({ except: new Set(['a']) })
  expect(selectionFor(view.last(), 'site')).toEqual({ except: new Set(['z']) })
})
