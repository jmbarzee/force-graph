import { describe, expect, it } from 'vitest'
import { createTaxonomy } from '../graph/taxonomy'
import type { GraphNode } from '../graph/model'
import { reconcileFilter } from './reconcile'
import { toggleGroup, toggleValue } from './toggle'
import type { AxisSelection, FilterState } from './types'
import { changedAxes, filterFromJSON, filterToJSON, initialFilter, passesDescriptors, reseedFilter, selectionFor, withSelection } from './types'

// An allow-list `team` and a narrowing `region`.
const taxonomy = createTaxonomy({
  styleAxis: 'kind', styles: [],
  filterAxes: [{ id: 'team', emptyMeans: 'none' }, { id: 'region', emptyMeans: 'all' }],
})
const graphOf = (...teams: string[]) => ({ nodes: teams.map((team, i): GraphNode => ({ id: `n${i}`, name: team, values: { team } })) })
const before = graphOf('a', 'b')
const grown = graphOf('a', 'b', 'c')
const shown = (filter: FilterState, team: string) => passesDescriptors(filter, taxonomy.filterAxes, axis => (axis === 'team' ? team : undefined))

/** A filter saved as text, restored over `graph` as a view restores one: the axes it differs from the opening filter on are the user's. */
function restore(saved: FilterState, graph: { nodes: GraphNode[] }) {
  const restored = filterFromJSON(JSON.parse(JSON.stringify(filterToJSON(saved))))!
  return { restored, touched: new Set(changedAxes(initialFilter(taxonomy, graph), restored)) }
}

describe('an axis selection', () => {
  it('seeds an allow-list as an exclusion and a narrowing axis as an empty inclusion', () => {
    expect(selectionFor(initialFilter(taxonomy, before), 'team')).toEqual({ except: new Set() })
    expect(selectionFor(initialFilter(taxonomy, before), 'region')).toEqual(new Set())
  })

  it('keeps its kind through a toggle: a value turned off joins `except`, one turned on leaves it', () => {
    const off = toggleValue(initialFilter(taxonomy, before), 'team', 'a')
    expect(selectionFor(off, 'team')).toEqual({ except: new Set(['a']) })
    expect(selectionFor(toggleGroup(off, 'team', ['a', 'b']), 'team')).toEqual({ except: new Set(['a', 'b']) })
    expect(selectionFor(toggleValue(off, 'team', 'a'), 'team')).toEqual({ except: new Set() })
    expect(selectionFor(toggleValue(withSelection(off, 'team', new Set(['b'])), 'team', 'a'), 'team')).toEqual(new Set(['a', 'b']))
  })

  it('widens an exclusion for a focus by leaving `except`', () => {
    const off = toggleValue(initialFilter(taxonomy, before), 'team', 'a')
    const { filter } = reconcileFilter({ destination: off, source: off, locks: new Map(), transition: { kind: 'focus', target: { values: { team: 'a' } } }, taxonomy, axes: ['team'] })
    expect(selectionFor(filter, 'team')).toEqual({ except: new Set() })
  })

  it('passes a value an exclusion leaves out, and one an inclusion names', () => {
    const off = toggleValue(initialFilter(taxonomy, before), 'team', 'a')
    expect([shown(off, 'a'), shown(off, 'c')]).toEqual([false, true])
    const only = withSelection(off, 'team', new Set(['a']))
    expect([shown(only, 'a'), shown(only, 'c')]).toEqual([true, false])
  })
})

describe('filterToJSON and filterFromJSON', () => {
  it('write an exclusion as { except } and an inclusion as an array, and read both back', () => {
    const filter: FilterState = new Map<string, AxisSelection>([['team', { except: new Set(['a']) }], ['region', new Set(['north'])]])
    expect(filterToJSON(filter)).toEqual({ team: { except: ['a'] }, region: ['north'] })
    expect(filterFromJSON(filterToJSON(filter))).toEqual(filter)
  })

  it('read text written before exclusions as inclusions', () => {
    expect(filterFromJSON({ team: ['a', 'b'] })).toEqual(new Map([['team', new Set(['a', 'b'])]]))
  })

  it('refuse an exclusion of any other shape', () => {
    expect(filterFromJSON({ team: { except: ['a'], also: [] } })).toBeUndefined()
    expect(filterFromJSON({ team: { except: 'a' } })).toBeUndefined()
  })
})

describe('a saved filter restored after the data gained a value', () => {
  const chipOff = toggleValue(initialFilter(taxonomy, before), 'team', 'a')
  const onlyA = withSelection(initialFilter(taxonomy, before), 'team', new Set(['a']))

  it('shows the value with a chip saved off, which stays off', () => {
    const { restored, touched } = restore(chipOff, grown)
    const filter = reseedFilter(restored, taxonomy, grown, touched)
    expect([shown(filter, 'a'), shown(filter, 'c')]).toEqual([false, true])
  })

  it('hides the value on an axis saved as an inclusion', () => {
    const { restored, touched } = restore(onlyA, grown)
    const filter = reseedFilter(restored, taxonomy, grown, touched)
    expect([shown(filter, 'a'), shown(filter, 'c')]).toEqual([true, false])
  })

  it('holds both when restored over an empty graph before the data arrives', () => {
    for (const [saved, a, c] of [[chipOff, false, true], [onlyA, true, false]] as const) {
      const { restored, touched } = restore(saved, graphOf())
      const filter = reseedFilter(restored, taxonomy, grown, touched)
      expect([shown(filter, 'a'), shown(filter, 'c')]).toEqual([a, c])
    }
  })
})
