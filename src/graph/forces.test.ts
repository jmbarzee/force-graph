import { describe, expect, it } from 'vitest'
import { resolveSprings, springFor } from './forces'
import { identityMapping } from './axis'
import { pairTuning } from './simulation'
import { createTaxonomy } from './taxonomy'
import { MIDDLING_SPRING } from './shapes'
import type { NodeStyle } from './shapes'

const style = (id: string): NodeStyle => ({
  id, label: id,
  color: { light: { fill: '#000000', border: '#000000' }, dark: { fill: '#ffffff', border: '#ffffff' } },
})

describe('springFor', () => {
  it('pulls the ends of an edge no declared type claims together, on the style axis', () => {
    const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [style('service'), style('queue')] })
    const spring = resolveSprings(pairTuning(identityMapping(taxonomy.axisFor('kind')!, taxonomy.styleValues)), taxonomy)
    const category = springFor(spring, { id: 'e', sourceId: 'a', targetId: 'b' }, { values: { kind: 'service' } }, { values: { kind: 'queue' } })
    expect(category.key).toBeUndefined()
    expect(category).toMatchObject(MIDDLING_SPRING)
  })
})
