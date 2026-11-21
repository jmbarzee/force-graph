// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it } from 'vitest'
import { useLinkedViews } from './useLinkedViews'
import type { LinkedViews, LinkedViewsOptions } from './useLinkedViews'
import { createTaxonomy } from '../../graph/taxonomy'
import type { Graph, GraphNode } from '../../graph/model'
import { chosenOn, withLock, withChosen } from '../../filter/types'

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
})

// Two allow-lists; `site` opens without `z`, which only the grown graph has, so a re-seed shows.
const taxonomy = createTaxonomy({
  styleAxis: 'kind', values: [],
  filterAxes: [{ id: 'team', emptyMeans: 'none' }, { id: 'site', emptyMeans: 'none', initialChosen: values => values.filter(v => v !== 'z') }],
})
const graphOf = (...pairs: [string, string][]): Graph => ({ nodes: pairs.map(([team, site], i): GraphNode => ({ id: `n${i}`, name: team, values: { team, site } })), edges: [] })
const first = graphOf(['a', 'x'], ['b', 'y'])
const grown = graphOf(['a', 'x'], ['b', 'y'], ['c', 'z'])

type View = 'list' | 'graph'
type Options = Omit<LinkedViewsOptions<View>, 'taxonomy' | 'views'>

/** Mount the hook over two views; `render` re-renders it with new options. */
async function mount(options: Options) {
  const out: { linked?: LinkedViews<View> } = {}
  function Harness(props: LinkedViewsOptions<View>) {
    out.linked = useLinkedViews(props)
    return null
  }
  const root = createRoot(document.createElement('div'))
  const render = (next: Options) => act(async () => {
    root.render(React.createElement(Harness, { taxonomy, views: ['list', 'graph'], ...next }))
  })
  await render(options)
  return { linked: () => out.linked!, render }
}

it('focuses a second view by a FocusTarget, widening it and carrying the target', async () => {
  const hook = await mount({ graph: { list: first }, defaults: () => ({ filter: new Map([['team', new Set(['a'])]]) }) })
  const target = { values: { team: 'b' } }
  await act(async () => { hook.linked().focus('list', target) })
  const list = hook.linked().of('list')
  expect(list.focus).toEqual({ id: undefined, key: 1, target })
  expect(chosenOn(list.filter, 'team')).toEqual(new Set(['a', 'b']))
})

it('clears a FocusTarget focus when the host\'s view reports it', async () => {
  const hook = await mount({ graph: { list: first } })
  await act(async () => { hook.linked().focus('list', { values: { team: 'b' } }) })
  const list = hook.linked().of('list')
  await act(async () => { list.onFocusResult(list.focus!, true) })
  expect(hook.linked().of('list').focus).toBeNull()
})

it('re-seeds each view from its own graph', async () => {
  const hook = await mount({ graph: { list: first, graph: first } })
  await hook.render({ graph: { list: first, graph: grown } })
  expect(chosenOn(hook.linked().of('graph').filter, 'site')).toEqual({ except: new Set(['z']) })
  expect(chosenOn(hook.linked().of('list').filter, 'site')).toEqual({ except: new Set() })
})

it('keeps an axis updateFilter wrote when a later graph re-seeds the rest', async () => {
  const hook = await mount({ graph: { graph: first } })
  await act(async () => { hook.linked().updateFilter('graph', f => withChosen(f, 'team', new Set(['a']))) })
  await hook.render({ graph: { graph: grown } })
  expect(chosenOn(hook.linked().of('graph').filter, 'team')).toEqual(new Set(['a']))
  expect(chosenOn(hook.linked().of('graph').filter, 'site')).toEqual({ except: new Set(['z']) })
})

it('keys the locks a focus overrides, and a manual switch clears them under a new key', async () => {
  const locked = { filter: new Map([['team', new Set(['a'])]]), locks: withLock(new Map(), 'team', true) }
  const hook = await mount({ graph: { graph: grown }, defaults: view => (view === 'graph' ? locked : undefined) })
  await act(async () => { hook.linked().focus('graph', grown.nodes[2]!) })
  expect(hook.linked().of('graph').overriddenLocks).toEqual({ axes: new Set(['team']), key: 1 })
  await act(async () => { hook.linked().switchTo('list') })
  await act(async () => { hook.linked().switchTo('graph') })
  expect(hook.linked().of('graph').overriddenLocks).toEqual({ axes: new Set(), key: 2 })
})

it('hands every view the same labels', async () => {
  const labels = { team: { a: 'Alpha' } }
  const hook = await mount({ graph: { list: first }, labels })
  expect([hook.linked().of('list').labels, hook.linked().of('graph').labels]).toEqual([labels, labels])
})
