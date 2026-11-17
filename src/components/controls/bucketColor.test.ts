import { expect, it } from 'vitest'
import { NEUTRAL_BUCKET_COLOR, bucketColor } from './bucketColor'
import { fillOf } from '../../graph/coloring'
import { createTaxonomy } from '../../graph/taxonomy'
import { identityMapping } from '../../graph/axis'
import type { AxisMapping } from '../../graph/axis'

const taxonomy = createTaxonomy({ styleAxis: 'kind', styles: [{ id: 'svc', label: 'Service' }], filterAxes: [{ id: 'team', emptyMeans: 'all' }, { id: 'kind', emptyMeans: 'all' }] })
const graph = { nodes: [{ id: 'a', name: 'a', values: { kind: 'svc', team: 'red' } }], edges: [] }
const fill = fillOf({ by: 'axis', axis: 'team' }, graph, taxonomy)
const identity = (axis: string): AxisMapping => identityMapping(taxonomy.axisFor(axis)!, ['red', 'svc'])

it("wears a key's colour on a row bucketing the fill's axis by identity, and neutral on any other", () => {
  expect(bucketColor(fill, identity('team'), 'red')).toBe(`var(${fill.keys.get('red')!.cssVar})`)
  expect(bucketColor(fill, identity('team'), 'blue')).toBe(NEUTRAL_BUCKET_COLOR)
  expect(bucketColor(fill, identity('kind'), 'svc')).toBe(NEUTRAL_BUCKET_COLOR)
})
