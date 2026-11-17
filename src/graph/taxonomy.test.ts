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
