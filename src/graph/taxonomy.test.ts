import { describe, expect, it } from 'vitest'
import { createTaxonomy, engineOf } from './taxonomy'
import { PALETTE, THEMES, pairOf } from './scheme'
import type { EdgeType, ValueSpec } from './shapes'
import type { GraphEdge } from './model'

const spec = (id: string): ValueSpec => ({
  id, label: id,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
})
const values = [spec('service'), spec('queue'), spec('store')]
const edge: GraphEdge = { id: 'e', sourceId: 'a', targetId: 'b' }
const dependency = (id: string, ends: Pick<EdgeType, 'sources' | 'targets'>): EdgeType => ({ id, relation: 'dependency', ...ends })

describe('edgeTypeOf', () => {
  it('lets a type with no targets claim an edge to any value', () => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', values, edgeTypes: [dependency('fromService', { sources: 'service' })] })
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'queue')).toBe('fromService')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'store')).toBe('fromService')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'queue', 'store')).toBeUndefined()
  })

  it('ranks a type naming both ends over one naming one, over one naming neither, whatever the declaration order', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', values, edgeTypes: [
        dependency('any', {}),
        dependency('fromService', { sources: 'service' }),
        dependency('serviceToQueue', { sources: 'service', targets: 'queue' }),
      ],
    })
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'queue')).toBe('serviceToQueue')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'store')).toBe('fromService')
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'queue', 'store')).toBe('any')
  })

  it('drops a type whose match the edge lacks before ranking by ends named', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', values, edgeTypes: [
        { ...dependency('calls', { sources: 'service', targets: 'queue' }), match: { kind: 'call' } },
        dependency('fromService', { sources: 'service' }),
      ],
    })
    expect(engineOf(taxonomy).edgeTypeOf({ ...edge, values: { kind: 'signal' } }, 'service', 'queue')).toBe('fromService')
  })

  it('refuses two types naming as many ends that nothing tells apart', () => {
    expect(() => createTaxonomy({
      styleAxis: 'kind', values, edgeTypes: [dependency('fromService', { sources: 'service' }), dependency('toQueue', { targets: 'queue' })],
    })).toThrow(/"fromService" and "toQueue"/)
  })

  it('refuses a direction on a containment type, even directed', () => {
    for (const direction of ['undirected', 'directed'] as const) {
      expect(() => createTaxonomy({
        styleAxis: 'kind', values, edgeTypes: [{ id: 'in', relation: 'containment', direction }],
      })).toThrow(/edgeTypes\.in\.direction is declared on a containment type/)
    }
  })

  it('refuses a direction that is neither directed nor undirected', () => {
    expect(() => createTaxonomy({
      styleAxis: 'kind', values, edgeTypes: [{ ...dependency('calls', {}), direction: 'both' as never }],
    })).toThrow(/edgeTypes\.calls\.direction is "both"/)
  })

  it('leaves an edge untyped when classifyEdge answers null, and keeps the declared type on undefined', () => {
    const taxonomy = createTaxonomy({
      styleAxis: 'kind', values, edgeTypes: [dependency('calls', { sources: 'service', targets: 'queue' })],
      classifyEdge: e => (e.id === 'skip' ? null : undefined),
    })
    expect(engineOf(taxonomy).edgeTypeOf({ ...edge, id: 'skip' }, 'service', 'queue')).toBeUndefined()
    expect(engineOf(taxonomy).edgeTypeOf(edge, 'service', 'queue')).toBe('calls')
  })
})

describe('edgeTypes', () => {
  it('resolves an end left out to every declared value, and its swatch half to null', () => {
    const [fromService] = createTaxonomy({ styleAxis: 'kind', values, edgeTypes: [dependency('fromService', { sources: 'service' })] }).edgeTypes()
    expect(fromService!.sources).toEqual(['service'])
    expect(fromService!.targets).toEqual(['service', 'queue', 'store'])
    expect(fromService!.swatch).toEqual(['service', null])
  })
})

describe('filterAxes', () => {
  it("refuses an axis by the group filter's id", () => {
    expect(() => createTaxonomy({ styleAxis: 'kind', values, filterAxes: [{ id: '@groups', emptyMeans: 'none' }] })).toThrow(/"@groups" is the group filter's entry/)
  })
})

describe('pairMappings', () => {
  const bucket = (id: string, values: string[]) => ({ id, label: id, abbreviation: id.slice(0, 1), values })
  const mapping = (id: string, buckets: ReturnType<typeof bucket>[]) => ({ id, label: id, axis: 'kind', buckets })

  it('builds each mapping in declaration order', () => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', values, pairMappings: [mapping('role', [bucket('control', ['service', 'queue']), bucket('work', ['store'])])] })
    expect(engineOf(taxonomy).pairMappings.map(m => m.id)).toEqual(['role'])
    expect(engineOf(taxonomy).pairMappings[0].bucketFor('queue')?.id).toBe('control')
  })

  it.each([
    ['a value in two buckets', [mapping('role', [bucket('a', ['service']), bucket('b', ['service'])])], /"service" is in both a and b/],
    ['an empty bucket', [mapping('role', [bucket('a', [])])], /bucket "a" has no values/],
    ['one id twice', [mapping('role', []), mapping('role', [])], /pair mapping "role" is declared twice/],
  ])('refuses %s', (_, pairMappings, message) => {
    expect(() => createTaxonomy({ styleAxis: 'kind', values, pairMappings })).toThrow(message)
  })
})

describe('createTaxonomy', () => {
  it('refuses a ladder id that is empty or a value’s', () => {
    expect(() => createTaxonomy({ styleAxis: 'kind', values: [{ ...spec('service'), ladder: '' }] })).toThrow(/values\.service\.ladder is empty/)
    expect(() => createTaxonomy({ styleAxis: 'kind', values: [{ ...spec('service'), ladder: 'queue' }, spec('queue')] })).toThrow(/values\.service\.ladder is "queue", a style value's id/)
  })
  it('resolves bare-id value specs to their ids and distinct palette colours in both themes', () => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [{ id: 'service' }, { id: 'queue' }, { id: 'store' }] })
    expect(taxonomy.styleValues().map(v => taxonomy.styleOf(v).label)).toEqual(['service', 'queue', 'store'])
    expect(taxonomy.styleOf('queue').color).toEqual(pairOf(PALETTE[1]))
    for (const theme of THEMES) {
      expect(new Set(taxonomy.styleValues().map(v => taxonomy.styleOf(v).color[theme].fill)).size).toBe(3)
    }
  })
  it('keeps a declared colour, and refuses one no reader parses', () => {
    expect(createTaxonomy({ styleAxis: 'kind', values: [{ id: 'q' }, spec('service')] }).styleOf('service').color).toEqual(spec('service').color)
    const color = { light: { fill: 'teal', border: '#000' }, dark: { fill: '#fff', border: '#fff' } }
    expect(() => createTaxonomy({ styleAxis: 'kind', values: [{ id: 'service', color }] })).toThrow(/values\.service\.color\.light\.fill is "teal"/)
  })
})
