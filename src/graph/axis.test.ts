import { describe, expect, it } from 'vitest'
import { countsOn, valuesOn } from './axis'
import { createTaxonomy } from './taxonomy'
import type { NodeStyle } from './shapes'
import type { AxisSelection, FilterState } from '../filter/types'

const style = (id: string): NodeStyle => ({
  id, label: id,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
})
const node = (id: string, values: Record<string, string>, copyKey?: string) => ({ id, values, copyKey })

describe('chipsFor', () => {
  it('orders the style axis\'s chips as styles declares them, however the nodes are ordered', () => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [style('service'), style('queue'), style('store')] })
    const nodes = [node('1', { kind: 'store' }), node('2', { kind: 'service' }), node('3', { kind: 'queue' })]
    for (const shuffled of [nodes, [...nodes].reverse(), [nodes[1], nodes[0], nodes[2]]]) {
      expect(taxonomy.filterAxes[0].chipsFor(valuesOn(shuffled, 'kind')).map(c => c.id)).toEqual(['service', 'queue', 'store'])
    }
  })

  it('puts the values `order` lists first, in its order, and the rest after them as encountered', () => {
    const seen: string[][] = []
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', styles: [],
      filterAxes: [
        { id: 'site', emptyMeans: 'all', order: ['z', 'missing', 'x'] },
        { id: 'team', emptyMeans: 'all', order: ['b'], chipsFor: values => { seen.push([...values]); return [] } },
      ],
    })
    expect(taxonomy.axisFor('site')!.chipsFor(['y', 'x', 'w', 'z']).map(c => c.id)).toEqual(['z', 'x', 'y', 'w'])
    taxonomy.axisFor('team')!.chipsFor(['a', 'b'])
    expect(seen).toEqual([['b', 'a']])
  })
})

describe('countsOn', () => {
  const taxonomy = createTaxonomy({
    styleAxis: 'kind', styles: [],
    filterAxes: [{ id: 'kind', emptyMeans: 'none' }, { id: 'site', emptyMeans: 'all' }],
  })
  const nodes = [
    node('c1', { kind: 'course', site: 'north' }, 'course:1'),
    node('c1b', { kind: 'course', site: 'north' }, 'course:1'),
    node('c2', { kind: 'course', site: 'south' }),
    node('l1', { kind: 'lab', site: 'south' }),
    node('d1', { kind: 'dept' }),
  ]
  const tally = (counts: ReturnType<typeof countsOn>) => Object.fromEntries([...counts].map(([axis, m]) => [axis, Object.fromEntries(m)]))

  it('counts every entity once per value without facets', () => {
    expect(tally(countsOn(nodes, ['kind', 'site']))).toEqual({
      kind: { course: 2, lab: 1, dept: 1 },
      site: { north: 1, south: 2 },
    })
  })

  it('counts each axis under the other axes\' selections, of either kind, and not under its own', () => {
    const filter: FilterState = new Map<string, AxisSelection>([['kind', { except: new Set(['lab']) }], ['site', new Set(['south'])]])
    expect(tally(countsOn(nodes, ['kind', 'site'], { filter, taxonomy }))).toEqual({
      // Under site = south: the north course is out; the dept has no site and stays.
      kind: { course: 1, lab: 1, dept: 1 },
      // Under kind ≠ lab: the lab is out.
      site: { north: 1, south: 1 },
    })
  })
})
