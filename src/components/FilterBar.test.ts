// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FilterBar, axesOpenedBy, axesReseeded, firstLine, tintOf } from './FilterBar'
import type { FilterBarProps } from './FilterBar'
import { fillOf } from '../graph/coloring'
import { FillContext } from './graph-view/useFill'
import { createTaxonomy } from '../graph/taxonomy'
import type { FilterState } from '../filter/types'
import { withLock } from '../filter/types'

describe('firstLine', () => {
  it('counts the items that wrap past the first line, and measures to its lowest', () => {
    // A centred label, then chips 25 high on lines 31 apart.
    const items = [{ top: 4, bottom: 21 }, { top: 0, bottom: 25 }, { top: 0, bottom: 25 }, { top: 31, bottom: 56 }, { top: 62, bottom: 87 }]
    expect(firstLine(items)).toEqual({ height: 25, rest: 2 })
  })

  it('has nothing to collapse in an empty row', () => {
    expect(firstLine([])).toEqual({ height: 0, rest: 0 })
  })

  it('has nothing to collapse in a hidden row, whose items have no height', () => {
    expect(firstLine([{ top: 0, bottom: 0 }, { top: 0, bottom: 0 }])).toEqual({ height: 0, rest: 0 })
  })
})

describe('tintOf', () => {
  const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [{ id: 'svc', label: 'Service' }], filterAxes: [{ id: 'team', emptyMeans: 'all' }, { id: 'site', emptyMeans: 'all' }] })
  const fill = fillOf({ by: 'axis', axis: 'team' }, { nodes: [{ id: 'a', name: 'a', values: { team: 'red', site: 'x' } }], edges: [] }, taxonomy)
  const chip = (values: string[], tint?: string) => ({ id: values.join(), label: values.join(), values, tint })

  it('wears a named key, else the one value of a chip on the fill’s axis, else nothing', () => {
    expect(tintOf(chip(['x'], 'red'), 'site', fill)).toBe('red')
    expect(tintOf(chip(['red']), 'team', fill)).toBe('red')
    expect(tintOf(chip(['red', 'blue']), 'team', fill)).toBeUndefined()
    expect(tintOf(chip(['x']), 'site', fill)).toBeUndefined()
  })

  it('draws a tint naming no key neutral', () => {
    expect(tintOf(chip(['red'], 'svc'), 'team', fill)).toBeUndefined()
  })
})

describe('axesOpenedBy', () => {
  const before: FilterState = new Map([['team', new Set(['a'])], ['region', new Set()]])
  const after: FilterState = new Map([['team', new Set(['a', 'b'])], ['region', new Set(['north'])]])

  it('opens every axis a change from outside the bar touched', () => {
    expect(axesOpenedBy(before, after, [])).toEqual(['team', 'region'])
  })

  it('leaves the axis the bar clicked as the user has it', () => {
    expect(axesOpenedBy(before, after, ['team'])).toEqual(['region'])
  })

  it('opens nothing when the choices are unchanged', () => {
    expect(axesOpenedBy(before, new Map(before), [])).toEqual([])
  })

  // An allow-list axis, whose seed excludes nothing.
  const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [], filterAxes: [{ id: 'team', emptyMeans: 'none' }] })
  const none = new Map([['team', []]])
  const thirty = new Map([['team', Array.from({ length: 30 }, (_, i) => `team ${i}`)]])

  it('leaves an axis as it is when a re-seed follows values that arrived', () => {
    const seeded: FilterState = new Map([['team', { except: new Set() }]])
    expect(axesOpenedBy(new Map(), seeded, axesReseeded(taxonomy, none, thirty, seeded))).toEqual([])
  })

  it('opens an axis whose values arrived when the change is not their seed', () => {
    const one: FilterState = new Map([['team', new Set(['team 3'])]])
    expect(axesOpenedBy(new Map(), one, axesReseeded(taxonomy, none, thirty, one))).toEqual(['team'])
  })
})

describe('FilterBar', () => {
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.matchMedia = () => ({ matches: false }) as MediaQueryList
    window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  })
  afterEach(() => { document.body.innerHTML = '' })

  const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [], filterAxes: [{ id: 'team', emptyMeans: 'none' }] })
  const values = new Map([['team', ['a', 'b']]])
  const onlyA: FilterState = new Map([['team', new Set(['a'])]])
  type Row = { id: string; name: string; values: { team: string } }
  type Props = Partial<Omit<FilterBarProps<Row>, 'values' | 'graph'>>

  /** Mount a bar in the document; `render` re-renders it with new props. */
  async function mount(props: Props) {
    const host = document.body.appendChild(document.createElement('div'))
    const root = createRoot(host)
    const render = (next: Props) => act(async () => {
      root.render(React.createElement(FilterBar<Row>, { taxonomy, filter: onlyA, onFilterChange: () => {}, ...next, available: values }))
    })
    await render(props)
    return { host, render }
  }
  const slash = () => act(async () => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true })) })

  it('tints each chip with its own key where two keys kebab-case alike', async () => {
    const langs = fillOf({ by: 'axis', axis: 'team' }, { nodes: ['C', 'C++'].map(team => ({ id: team, name: team, values: { team } })), edges: [] }, taxonomy)
    const host = document.createElement('div')
    await act(async () => {
      createRoot(host).render(React.createElement(FillContext.Provider, { value: langs },
        React.createElement(FilterBar, { taxonomy, axes: ['team'], available: new Map([['team', ['C', 'C++']]]), filter: new Map(), onFilterChange: () => {} })))
    })
    const tints = [...host.querySelectorAll<HTMLElement>('.gv-chip')].map(c => c.style.getPropertyValue('--gv-chip-tint'))
    expect(tints).toEqual(['var(--gv-node-c)', 'var(--gv-node-c-2)'])
  })

  it('badges the matches its records hide, on their chip and as the search\'s +N', async () => {
    const records: Row[] = [{ id: '1', name: 'xa', values: { team: 'a' } }, { id: '2', name: 'xb', values: { team: 'b' } }, { id: '3', name: 'yb', values: { team: 'b' } }]
    const { host } = await mount({ records, matches: (r, q) => r.name.includes(q), search: { query: 'x', active: true } })
    const chipB = [...host.querySelectorAll('.gv-chip')].find(c => c.querySelector('.gv-chip-label')?.textContent === 'b')!
    expect(chipB.querySelector('.gv-header-hidden-badge')?.textContent).toBe('1')
    expect(host.querySelector('.gv-header-search-badge')?.textContent).toBe('+1')
  })

  it('badges from hiddenMatches over what its records would give', async () => {
    const records: Row[] = [{ id: '1', name: 'xb', values: { team: 'b' } }]
    const hiddenMatches = { hiddenCount: 3, hiddenByAxis: new Map([['team', new Map([['b', 2]])]]) }
    const { host } = await mount({ records, matches: (r, q) => r.name.includes(q), hiddenMatches, search: { query: 'x', active: true } })
    const chipB = [...host.querySelectorAll('.gv-chip')].find(c => c.querySelector('.gv-chip-label')?.textContent === 'b')!
    expect(chipB.querySelector('.gv-header-hidden-badge')?.textContent).toBe('2')
    expect(host.querySelector('.gv-header-search-badge')?.textContent).toBe('+3')
  })

  it('shows a chip by its label and toggles it by its value', async () => {
    const changes: FilterState[] = []
    const { host } = await mount({ labels: { team: { a: 'Alpha', b: 'Alpha' } }, onFilterChange: next => { changes.push(next) } })
    const chips = [...host.querySelectorAll<HTMLElement>('.gv-chip')]
    expect(chips.map(c => c.querySelector('.gv-chip-label')?.textContent)).toEqual(['Alpha', 'Alpha'])
    await act(async () => { chips[1].click() })
    expect(changes.map(f => [...(f.get('team') as Set<string>)])).toEqual([['a', 'b']])
  })

  it('badges chips with faceted counts: each axis under the other\'s choice', async () => {
    const faceted = createTaxonomy({ styleAxis: 'kind', values: [], filterAxes: [{ id: 'team', emptyMeans: 'none' }, { id: 'site', emptyMeans: 'all' }] })
    const graph = { nodes: [['a', 'x'], ['a', 'y'], ['b', 'y']].map(([team, site], i) => ({ id: `${i}`, name: team, values: { team, site } })), edges: [] }
    const host = document.body.appendChild(document.createElement('div'))
    const filter: FilterState = new Map([['team', new Set(['a'])], ['site', new Set(['y'])]])
    await act(async () => {
      createRoot(host).render(React.createElement(FilterBar, { taxonomy: faceted, axes: ['team', 'site'], graph, counts: 'faceted', filter, onFilterChange: () => {} }))
    })
    const badges = [...host.querySelectorAll('.gv-chip')].map(c => `${c.querySelector('.gv-chip-label')?.textContent}:${c.querySelector('.gv-header-chip-count')?.textContent}`)
    expect(badges).toEqual(['a:1', 'b:1', 'x:1', 'y:1'])
  })

  it('opens its search on / when shown, and says so', async () => {
    const { host } = await mount({})
    expect(host.querySelector('.gv-header-search-toggle')?.getAttribute('title')).toBe('Search (/)')
    await slash()
    expect(host.querySelector('.gv-header-search-input')).not.toBeNull()
  })

  it('leaves / alone when hidden', async () => {
    const { host } = await mount({})
    host.style.display = 'none'
    await slash()
    expect(host.querySelector('.gv-header-search-input')).toBeNull()
  })

  it('leaves / to a host that focuses the input itself, and names no key', async () => {
    const { host } = await mount({ searchInputRef: React.createRef<HTMLInputElement>() })
    expect(host.querySelector('.gv-header-search-toggle')?.getAttribute('title')).toBe('Search')
    await slash()
    expect(host.querySelector('.gv-header-search-input')).toBeNull()
  })

  it('flashes the overridden locks once per key, not per set', async () => {
    vi.useFakeTimers()
    const locked = { locks: withLock(new Map(), 'team', true), onLocksChange: () => {} }
    const { host, render } = await mount({ ...locked, overriddenLocks: { axes: new Set(['team']), key: 1 } })
    const flashing = () => host.querySelector('.gv-lock-toggle')!.classList.contains('flashing')
    expect(flashing()).toBe(true)
    await act(async () => { vi.advanceTimersByTime(600) })
    await render({ ...locked, overriddenLocks: { axes: new Set(['team']), key: 1 } })
    expect(flashing()).toBe(false)
    await render({ ...locked, overriddenLocks: { axes: new Set(['team']), key: 2 } })
    expect(flashing()).toBe(true)
    vi.useRealTimers()
  })
})
