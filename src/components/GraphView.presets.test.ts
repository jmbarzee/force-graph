// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, expect, it, vi } from 'vitest'
import { GraphView } from './GraphView'
import { createTaxonomy } from '../graph/taxonomy'
import { createTuning, tuningToJSON } from '../graph/tuning'
import type { Tuning } from '../graph/tuning'
import { TUNING_PRESETS } from '../graph/presets'
import type { TuningPreset } from '../graph/presets'
import type { Graph } from '../graph/model'

vi.mock('./GraphCanvas', () => ({ GraphCanvas: () => null }))

let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let reducedMotion = false
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  reducedMotion = false
  window.matchMedia = (query: string) => ({ matches: reducedMotion && query.includes('reduce') }) as MediaQueryList
  window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  frames = new Map()
  window.requestAnimationFrame = cb => { frames.set(++nextFrame, cb); return nextFrame }
  window.cancelAnimationFrame = id => { frames.delete(id) }
})

/** Run one round of frames, `ms` past now. */
const frame = (ms: number) => act(async () => {
  const due = [...frames.values()]
  frames = new Map()
  for (const cb of due) cb(performance.now() + ms)
})

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [], filterAxes: [] })
const graph: Graph = { nodes: [{ id: 'a', name: 'a', values: {} }, { id: 'b', name: 'b', values: {} }], edges: [{ id: 'ab', sourceId: 'a', targetId: 'b' }] }
const SPREAD = TUNING_PRESETS.findIndex(p => p.label === 'Spread out')
const spread = createTuning(TUNING_PRESETS[SPREAD]!.tuning, taxonomy)
const push = (t: Tuning) => tuningToJSON(t).forces!.pushMultiplier

async function mount(presets?: readonly TuningPreset[]) {
  const reported: Tuning[] = []
  const el = document.createElement('div')
  const root = createRoot(el)
  await act(async () => {
    root.render(React.createElement(GraphView, { graph, taxonomy, presets, onTuningChange: t => reported.push(t) }))
  })
  await act(async () => el.querySelector<HTMLButtonElement>('.gv-graph-control-panel-toggle')!.click())
  const select = () => el.querySelector<HTMLSelectElement>('.gv-preset-row select')
  const choose = (index: number) => act(async () => {
    const s = select()!
    s.value = String(index)
    s.dispatchEvent(new Event('change', { bubbles: true }))
  })
  return { reported, select, choose, last: () => reported[reported.length - 1]! }
}

it('carries the tuning to a chosen preset over frames, telling the host each one', async () => {
  const view = await mount()
  expect(view.select()!.value).toBe('0')
  await view.choose(SPREAD)
  await frame(100)
  const mid = push(view.last())!
  expect(mid).toBeGreaterThan(push(createTuning({}, taxonomy))!)
  expect(mid).toBeLessThan(push(spread)!)
  await frame(1000)
  expect(tuningToJSON(view.last())).toEqual(tuningToJSON(spread))
  expect(view.reported.length).toBeGreaterThan(2)
  expect(view.select()!.value).toBe(String(SPREAD))
})

it('jumps under reduced motion', async () => {
  reducedMotion = true
  const view = await mount()
  await view.choose(SPREAD)
  expect(tuningToJSON(view.last())).toEqual(tuningToJSON(spread))
})

it('lists a host preset the taxonomy refuses disabled, and says so once', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const view = await mount([...TUNING_PRESETS, { label: 'By team', tuning: { forces: { pair: { axis: 'team' } } } }])
  const option = view.select()!.options[TUNING_PRESETS.length]!
  expect(option.disabled).toBe(true)
  expect(option.textContent).toBe('By team — forces.pair.axis: no axis "team"')
  expect(warn.mock.calls.filter(([m]) => String(m).includes('"By team"'))).toHaveLength(1)
  warn.mockRestore()
})

it('draws no preset row for presets={[]}', async () => {
  const view = await mount([])
  expect(view.select()).toBeNull()
})
