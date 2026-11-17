// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from './GraphView'
import type { GraphViewHandle, GraphViewProps } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import type { Graph, GraphNode } from '../graph/model'
import { withSelection } from '../filter/types'

const drawn = vi.hoisted(() => ({ focused: null as string | null, hover: (_id: string | null) => {} }))
vi.mock('./GraphCanvas', () => ({
  GraphCanvas: (props: { focusedNodeId: string | null; onHoverNode: typeof drawn.hover }) => {
    drawn.focused = props.focusedNodeId
    drawn.hover = props.onHoverNode
    return null
  },
}))

const roots: Root[] = []
afterEach(() => act(() => { for (const root of roots.splice(0)) root.unmount() }))
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: false }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
})

// Root holds Beta and Alpha, Alpha holds Apple; Zed stands alone. The style
// axis filters too, so a test can hide a container and keep its child.
const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [{ id: 'root', label: 'Tree' }, { id: 'a', label: 'Branch' }, { id: 'b', label: 'Branch' }, { id: 'a1', label: 'Fruit' }, { id: 'z', label: 'Stone' }],
  filterAxes: [{ id: 'kind', emptyMeans: 'none' }],
})
const node = (id: string, name: string, parentId?: string): GraphNode => ({ id, name, parentId, values: { kind: id === 'r' ? 'root' : id } })
const tree: Graph = { nodes: [node('r', 'Root'), node('b', 'Beta', 'r'), node('a', 'Alpha', 'r'), node('a1', 'Apple', 'a'), node('z', 'Zed')], edges: [] }

async function mount(props: Partial<GraphViewProps> = {}, graph = tree) {
  const ref = React.createRef<GraphViewHandle>()
  const el = document.body.appendChild(document.createElement('div'))
  const root = createRoot(el)
  roots.push(root)
  const render = (graph: Graph) => act(async () => { root.render(React.createElement(GraphView, { ref, graph, taxonomy, ...props })) })
  await render(graph)
  const pane = el.querySelector<HTMLElement>('.gv-graph-view')!
  await act(async () => pane.focus())
  /** Press a key on the pane: whether the pane kept it from the browser. */
  const press = async (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init })
    await act(async () => { pane.dispatchEvent(event) })
    return event.defaultPrevented
  }
  const tab = async (times: number, init: KeyboardEventInit = {}) => { for (let i = 0; i < times; i++) await press('Tab', init) }
  const hide = (...kinds: string[]) => act(async () => ref.current!.updateFilter(f => withSelection(f, 'kind', new Set(['root', 'a', 'b', 'a1', 'z'].filter(k => !kinds.includes(k))))))
  const said = () => el.querySelector('[role="status"]')!.textContent
  const boxed = () => el.querySelector('.gv-tooltip-name')?.textContent
  return { ref, el, pane, render, press, tab, hide, said, boxed }
}

it('names the pane with its counts', async () => {
  const view = await mount()
  expect(view.pane.getAttribute('aria-label')).toBe('Graph, 5 nodes, 3 edges')
})

it('tabs depth-first by containment, siblings by name, and back with Shift', async () => {
  const view = await mount()
  const seen: (string | null)[] = []
  for (let i = 0; i < 5; i++) { await view.tab(1); seen.push(drawn.focused) }
  expect(seen).toEqual(['r', 'a', 'a1', 'b', 'z'])
  await view.tab(2, { shiftKey: true })
  expect(drawn.focused).toBe('a1')
})

it('leaves Tab to the browser past either end, keeping the focus', async () => {
  const view = await mount()
  expect(await view.press('Tab', { shiftKey: true })).toBe(true)
  expect(drawn.focused).toBe('z')
  expect(await view.press('Tab')).toBe(false)
  expect(drawn.focused).toBe('z')
  await view.tab(4, { shiftKey: true })
  expect(drawn.focused).toBe('r')
  expect(await view.press('Tab', { shiftKey: true })).toBe(false)
  expect(drawn.focused).toBe('r')
})

it('tabs the nodes under a global keyboard once the pane has focus', async () => {
  const view = await mount({ keyboard: 'global' })
  expect(view.pane.tabIndex).toBe(0)
  await view.tab(1)
  expect(drawn.focused).toBe('r')
})

it('holds the focus by id over a filter, then moves it to the nearest drawn container', async () => {
  const view = await mount()
  await view.tab(3)
  await view.hide('a')
  expect(drawn.focused).toBe('a1')
  await view.hide('a', 'a1')
  expect(drawn.focused).toBe('r')
  await view.hide()
  expect(drawn.focused).toBe('r')
  await view.hide('root', 'a', 'b', 'a1')
  expect(drawn.focused).toBeNull()
})

it('holds the focus by id over a reload, then moves it to the nearest container left', async () => {
  const view = await mount()
  await view.tab(3)
  await view.render({ ...tree, nodes: [...tree.nodes, node('c', 'Cherry', 'a')] })
  expect(drawn.focused).toBe('a1')
  await view.render({ ...tree, nodes: tree.nodes.filter(n => n.id !== 'a1') })
  expect(drawn.focused).toBe('a')
  await view.render({ ...tree, nodes: [node('z', 'Zed')] })
  expect(drawn.focused).toBeNull()
})

it('moves the focus to the container a reload gave it, not the one it had', async () => {
  const view = await mount()
  await view.tab(3)
  await view.render({ ...tree, nodes: tree.nodes.map(n => (n.id === 'a1' ? { ...n, parentId: 'b' } : n)) })
  await view.hide('a1')
  expect(drawn.focused).toBe('b')
})

it('announces the focused node: its name, its style value and its context', async () => {
  const view = await mount()
  expect(view.said()).toBe('')
  await view.tab(3)
  expect(view.said()).toBe('Apple, Fruit, Alpha')
})

it('boxes the focused node while the pane holds focus, the pointer winning while it hovers', async () => {
  vi.useFakeTimers()
  try {
    const view = await mount()
    await view.tab(2)
    expect(view.boxed()).toBe('Alpha')
    await act(async () => drawn.hover('z'))
    expect(view.boxed()).toBe('Zed')
    await act(async () => { drawn.hover(null); vi.advanceTimersByTime(150) })
    expect(view.boxed()).toBe('Alpha')
    await act(async () => view.pane.blur())
    expect(view.boxed()).toBeUndefined()
  } finally {
    vi.useRealTimers()
  }
})

it('clears the selection on Escape, then gives focus back, and leaves a chord alone', async () => {
  const onSelectionChange = vi.fn()
  const view = await mount({ defaultSelectedIds: new Set(['z']), onSelectionChange })
  await view.press('Tab', { ctrlKey: true })
  expect(drawn.focused).toBeNull()
  await view.press('Escape')
  expect(onSelectionChange).toHaveBeenLastCalledWith([])
  expect(document.activeElement).toBe(view.pane)
  await view.press('Escape')
  expect(document.activeElement).not.toBe(view.pane)
})
