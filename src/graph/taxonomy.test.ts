import { describe, expect, it } from 'vitest'
import { createTaxonomy } from './taxonomy'
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
    expect(taxonomy.edgeTypeOf(edge, 'service', 'queue')).toBe('fromService')
    expect(taxonomy.edgeTypeOf(edge, 'service', 'store')).toBe('fromService')
    expect(taxonomy.edgeTypeOf(edge, 'queue', 'store')).toBeUndefined()
  })

  it('ranks a type naming both ends over one naming one, over one naming neither, whatever the declaration order', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [
        dependency('any', {}),
        dependency('fromService', { sourceValue: 'service' }),
        dependency('serviceToQueue', { sourceValue: 'service', targetValue: 'queue' }),
      ],
    })
    expect(taxonomy.edgeTypeOf(edge, 'service', 'queue')).toBe('serviceToQueue')
    expect(taxonomy.edgeTypeOf(edge, 'service', 'store')).toBe('fromService')
    expect(taxonomy.edgeTypeOf(edge, 'queue', 'store')).toBe('any')
  })

  it('drops a type whose match the edge lacks before ranking by ends named', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [
        { ...dependency('calls', { sourceValue: 'service', targetValue: 'queue' }), match: { kind: 'call' } },
        dependency('fromService', { sourceValue: 'service' }),
      ],
    })
    expect(taxonomy.edgeTypeOf({ ...edge, values: { kind: 'signal' } }, 'service', 'queue')).toBe('fromService')
  })

  it('refuses two types naming as many ends that nothing tells apart', () => {
    expect(() => createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [dependency('fromService', { sourceValue: 'service' }), dependency('toQueue', { targetValue: 'queue' })],
    })).toThrow(/"fromService" and "toQueue"/)
  })

  it('leaves an edge untyped when classifyEdge answers null, and keeps the declared type on undefined', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', styles, edgeTypes: [dependency('calls', { sourceValue: 'service', targetValue: 'queue' })],
      classifyEdge: e => (e.id === 'skip' ? null : undefined),
    })
    expect(taxonomy.edgeTypeOf({ ...edge, id: 'skip' }, 'service', 'queue')).toBeUndefined()
    expect(taxonomy.edgeTypeOf(edge, 'service', 'queue')).toBe('calls')
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
})
