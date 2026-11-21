import { describe, expect, it } from 'vitest'
import { ABSENT_EDGE_PHYSICS, resolveSprings, springFor } from './forces'
import { identityMapping } from './axis'
import { pairTuning, withSpringOverride } from './simulation'
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
