import { describe, expect, it } from 'vitest'
import { createTaxonomy, engineOf } from './taxonomy'
import { PALETTE, THEMES, pairOf } from './scheme'
import type { EdgeType, NodeStyle } from './shapes'
import type { GraphEdge } from './model'

const style = (id: string): NodeStyle => ({
  id, label: id,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
})
const styles = [style('service'), style('queue'), style('store')]
const edge: GraphEdge = { id: 'e', sourceId: 'a', targetId: 'b' }
const dependency = (id: string, ends: Pick<EdgeType, 'sourceValue' | 'targetValue'>): EdgeType => ({ id, relation: 'dependency', ...ends })

describe('edgeTypeOf', () => {
  it('lets a type with no targetValue claim an edge to any value', () => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', styles, edgeTypes: [dependency('fromService', { sourceValue: 'service' })] })
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'queue')).toBe('fromService')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'store')).toBe('fromService')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'queue', 'store')).toBeUndefined()
  })

  it('ranks a type naming both ends over one naming one, over one naming neither, whatever the declaration order', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [
        dependency('any', {}),
        dependency('fromService', { sourceValue: 'service' }),
        dependency('serviceToQueue', { sourceValue: 'service', targetValue: 'queue' }),
      ],
    })
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'queue')).toBe('serviceToQueue')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'store')).toBe('fromService')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'queue', 'store')).toBe('any')
  })

  it('drops a type whose match the edge lacks before ranking by ends named', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [
        { ...dependency('calls', { sourceValue: 'service', targetValue: 'queue' }), match: { kind: 'call' } },
        dependency('fromService', { sourceValue: 'service' }),
      ],
    })
    expect(engineOf(taxonomy).edgeTypeOf({ ...edge, values: { kind: 'signal' } }, 'service', 'queue')).toBe('fromService')
  })

  it('refuses two types naming as many ends that nothing tells apart', () => {
    expect(() => createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [dependency('fromService', { sourceValue: 'service' }), dependency('toQueue', { targetValue: 'queue' })],
    })).toThrow(/"fromService" and "toQueue"/)
  })

  it('refuses a direction on a containment type, even directed', () => {
    for (const direction of ['undirected', 'directed'] as const) {
      expect(() => createTaxonomy({
        styleAxis: 'kind', styles, edgeTypes: [{ id: 'in', relation: 'containment', direction }],
      })).toThrow(/edgeTypes\.in\.direction is declared on a containment type/)
    }
  })

  it('refuses a direction that is neither directed nor undirected', () => {
    expect(() => createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [{ ...dependency('calls', {}), direction: 'both' as never }],
    })).toThrow(/edgeTypes\.calls\.direction is "both"/)
  })

  it('leaves an edge untyped when classifyEdge answers null, and keeps the declared type on undefined', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [dependency('calls', { sourceValue: 'service', targetValue: 'queue' })],
      classifyEdge: e => (e.id === 'skip' ? null : undefined),
    })
    expect(engineOf(taxonomy).edgeTypeOf({ ...edge, id: 'skip' }, 'service', 'queue')).toBeUndefined()
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'queue')).toBe('calls')
  })
})

describe('edgeTypes', () => {
  it('resolves an end left out to every declared value, and its swatch half to null', () => {
    const [fromService] = createTaxonomy({ styleAxis: 'kind', styles, edgeTypes: [dependency('fromService', { sourceValue: 'service' })] }).edgeTypes
    expect(fromService!.sources).toEqual(['service'])
    expect(fromService!.targets).toEqual(['service', 'queue', 'store'])
    expect(fromService!.swatch).toEqual(['service', null])
  })
})

describe('filterAxes', () => {
  it("refuses an axis by the group filter's id", () => {
    expect(() => createTaxonomy({ styleAxis: 'kind', styles, filterAxes: [{ id: '@groups', emptyMeans: 'none' }] })).toThrow(/"@groups" is the group filter's entry/)
  })
})

describe('createTaxonomy', () => {
  it('refuses a ladder id that is empty or a value’s', () => {
    expect(() => createTaxonomy({ styleAxis: 'kind', styles: [{ ...style('service'), ladder: '' }] })).toThrow(/styles\.service\.ladder is empty/)
    expect(() => createTaxonomy({ styleAxis: 'kind', styles: [{ ...style('service'), ladder: 'queue' }, style('queue')] })).toThrow(/styles\.service\.ladder is "queue", a style value's id/)
  })
  it('resolves bare-id styles to their ids and distinct palette colours in both themes', () => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [{ id: 'service' }, { id: 'queue' }, { id: 'store' }] })
    expect(taxonomy.styleValues.map(v => taxonomy.styleOf(v).label)).toEqual(['service', 'queue', 'store'])
    expect(taxonomy.styleOf('queue').color).toEqual(pairOf(PALETTE[1]))
    for (const theme of THEMES) {
      expect(new Set(taxonomy.styleValues.map(v => taxonomy.styleOf(v).color[theme].fill)).size).toBe(3)
    }
  })
  it('keeps a declared colour, and refuses one no reader parses', () => {
    expect(createTaxonomy({ styleAxis: 'kind', styles: [{ id: 'q' }, style('service')] }).styleOf('service').color).toEqual(style('service').color)
    const color = { light: { fill: 'teal', border: '#000' }, dark: { fill: '#fff', border: '#fff' } }
    expect(() => createTaxonomy({ styleAxis: 'kind', styles: [{ id: 'service', color }] })).toThrow(/styles\.service\.color\.light\.fill is "teal"/)
  })
})
