// The colour a control surface paints one bucket of an axis.
//
// On the axis the fill follows, bucketed by identity, a bucket IS a fill key
// and takes that key's colour — the `--gv-node-<suffix>` the pane carries
// inline in its resolved theme, so a token and its nodes match across themes.
// Any other bucketing has no colour of its own, and says so with one neutral
// tone.

import type { AxisMapping } from '../../graph/axis'
import { isIdentityMapping } from '../../graph/axis'
import type { Fill } from '../../graph/coloring'
import type { Taxonomy } from '../../graph/taxonomy'

export const NEUTRAL_BUCKET_COLOR = 'var(--gv-color-text-muted)'

/** Whether `mapping` buckets the style axis by identity: each bucket a styled value. */
export function bucketsStyles(taxonomy: Taxonomy, mapping: AxisMapping): boolean {
  return mapping.axis === taxonomy.styleAxis() && isIdentityMapping(mapping)
}

/** Whether `mapping` buckets the axis the fill follows by identity: each bucket a key. */
export function bucketsFill(fill: Fill, mapping: AxisMapping): boolean {
  return mapping.axis === fill.axis && isIdentityMapping(mapping)
}

export function bucketColor(taxonomy: Taxonomy, fill: Fill, mapping: AxisMapping, bucketId: string): string {
  return bucketsFill(fill, mapping) && fill.keys.has(bucketId) ? `var(${taxonomy.colorVar(bucketId)})` : NEUTRAL_BUCKET_COLOR
}
