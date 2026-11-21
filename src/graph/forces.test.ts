import { describe, expect, it, vi } from 'vitest'
import { ABSENT_EDGE_PHYSICS, layoutFrame, resolvePhysics, resolveSprings, springFor } from './forces'
import { identityMapping } from './axis'
import { defaultParamsFor, pairTuning, withSpringOverride } from './simulation'
import { readableGraph } from './model'
import type { Scalar } from './scalar'
import { createTaxonomy } from './taxonomy'
import { MIDDLING_SPRING } from './shapes'
import type { ValueSpec } from './shapes'

const spec = (id: string): ValueSpec => ({
  id, label: id,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
})

describe('springFor', () => {
  const taxonomy = createTaxonomy({
    styleAxis: 'kind', values: [spec('service'), spec('queue')],
    edgeTypes: [{ id: 'calls', relation: 'dependency', sources: 'service', targets: 'service' }],
  })
  const pair = pairTuning(identityMapping(taxonomy.axisFor('kind')!, taxonomy.styleValues()))
  const edge = { id: 'e', sourceId: 'a', targetId: 'b' }
  const service = { values: { kind: 'service' } }
  const queue = { values: { kind: 'queue' } }
  const untyped = JSON.stringify(['untyped', 'dependency'])

  it('springs an edge no declared type claims in its relation\'s untyped category, from the middling spring', () => {
    const category = springFor(resolveSprings(pair, taxonomy), edge, service, queue)
    expect(category.key).toBe(untyped)
    expect(category).toMatchObject(MIDDLING_SPRING)
  })

  it('describes the untyped category as a token with no end named', () => {
    expect(resolveSprings(pair, taxonomy).describe(untyped)).toMatchObject({ label: 'untyped', swatch: [null, null], relation: 'dependency' })
  })

  it('moves an untyped edge, and not a typed one, when the untyped category is tuned', () => {
    const tuned = resolveSprings(withSpringOverride(pair, untyped, { strength: 1.5, distance: 400 }), taxonomy)
    expect(springFor(tuned, edge, service, queue)).toMatchObject({ strength: 1.5, distance: 400 })
    expect(springFor(tuned, edge, service, service)).toMatchObject({ key: 'calls', ...MIDDLING_SPRING })
  })

  it('leaves an edge with an unbucketed end no category and no pull', () => {
    const category = springFor(resolveSprings(pair, taxonomy), edge, service, { values: {} })
    expect(category.key).toBeUndefined()
    expect(category).toMatchObject(ABSENT_EDGE_PHYSICS)
  })
})

describe('layoutFrame', () => {
  const nodes = ['a', 'b', 'c'].map(id => ({ id, name: id, values: {} }))
  const graph = readableGraph({ nodes, edges: [] })
  // A frame with `scalar` on one axis, over a span about the centre; `b` answers `answer`, the others 0 and 1.
  const frameOn = (axis: 'x' | 'y', scalar: Omit<Scalar, 'id'>) => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [], scalars: [{ id: 'rank', ...scalar }] })
    const key = axis === 'x' ? 'bandX' : 'bandY'
    return layoutFrame(graph, resolvePhysics({ ...defaultParamsFor(taxonomy), [key]: { scalar: 'rank', span: { zero: -100, one: 100 } } }, taxonomy))
  }
  const answering = (answer: number) => () => new Map([['a', 0], ['b', answer], ['c', 1]])

  describe.each(['x', 'y'] as const)('on %s', axis => {
    it.each([
      [NaN, 'max', 'a finite number'], [Infinity, 'max', 'a finite number'], [-Infinity, 'range', 'a finite number'],
      [-1, 'max', 'in [0, 1]'], [1.5, 'none', 'in [0, 1]'], [-0.5, 'none', 'in [0, 1]'],
    ] as const)('refuses %s under %s, resting only that node at the centre', (answer, normalize, contract) => {
      const frame = frameOn(axis, { compute: answering(answer), normalize })
      expect(frame.diagnostics).toEqual([{
        severity: 'warning', code: 'scalar-answer-refused', nodeId: 'b',
        message: `scalar "rank" answered ${String(answer)} for node "b"; a scalar answers ${contract}; the node rests at the axis's centre`,
      }])
      const kept = frameOn(axis, { compute: () => new Map([['a', 0], ['c', 1]]), normalize })
      for (const node of nodes) expect(frame.rest(axis, node)).toEqual(kept.rest(axis, node))
      expect(frame.rest(axis, nodes[1]!)).toEqual({ lo: 0, hi: 0 })
    })
  })

  it('rests every node at the centre when the scalar throws, and says so', () => {
    const frame = frameOn('y', { compute: () => { throw new Error('no rank') } })
    expect(frame.diagnostics).toEqual([{
      severity: 'warning', code: 'scalar-compute-threw',
      message: `scalar "rank" threw: no rank; every node rests at the axis's centre`,
    }])
    for (const node of nodes) expect(frame.rest('y', node)).toEqual({ lo: 0, hi: 0 })
    expect(frame.ringOf(nodes[0]!)).toBe(0)
  })

  describe('with scalars on both axes', () => {
    const span = { zero: -100, one: 100 }
    const frameOnBoth = (x: Scalar, y: Scalar) => {
      const taxonomy = createTaxonomy({ styleAxis: 'kind', values: [], scalars: x === y ? [x] : [x, y] })
      return layoutFrame(graph, resolvePhysics({ ...defaultParamsFor(taxonomy), bandX: { scalar: x.id, span }, bandY: { scalar: y.id, span } }, taxonomy))
    }
    const said = (code: string, scalar: string, nodeId?: string) => ({ code, ...(nodeId && { nodeId }), message: expect.stringContaining(`scalar "${scalar}"`) })

    it('computes one scalar once, and reports each refusal once', () => {
      const compute = vi.fn(answering(NaN))
      const rank = { id: 'rank', compute }
      expect(frameOnBoth(rank, rank).diagnostics).toMatchObject([said('scalar-answer-refused', 'rank', 'b')])
      expect(compute).toHaveBeenCalledTimes(1)
    })

    it('reports one scalar\'s throw once', () => {
      const rank = { id: 'rank', compute: () => { throw new Error('no rank') } }
      expect(frameOnBoth(rank, rank).diagnostics).toMatchObject([said('scalar-compute-threw', 'rank')])
    })

    it('reports each of two scalars\' refusals', () => {
      const frame = frameOnBoth({ id: 'rank', compute: answering(NaN) }, { id: 'age', compute: answering(NaN) })
      expect(frame.diagnostics).toMatchObject([said('scalar-answer-refused', 'rank', 'b'), said('scalar-answer-refused', 'age', 'b')])
    })
  })

  it('says nothing of answers within bounds', () => {
    const frame = frameOn('y', { compute: answering(0.5), normalize: 'none' })
    expect(frame.diagnostics).toEqual([])
    expect(frame.rest('y', nodes[1]!)).not.toEqual(frame.rest('y', nodes[0]!))
  })
})
