// The colour a control surface paints one bucket of an axis.
//
// On the style axis, bucketed by identity, a bucket IS a styled value and takes
// that value's colour — the `--gv-node-<suffix>` the pane carries inline in its
// resolved theme, so a token and its nodes match across themes. Any other
// bucketing has no declared colour (there is no palette for arbitrary axes
// yet), and says so with one neutral tone rather than warning its way to the
// fallback style once per bucket.

import type { AxisMapping } from '../../graph/axis'
import { isIdentityMapping } from '../../graph/axis'
import type { Taxonomy } from '../../graph/taxonomy'

export const NEUTRAL_BUCKET_COLOR = 'var(--gv-color-text-muted)'

/** Whether `mapping` buckets the style axis by identity: each bucket a styled value. */
export function bucketsStyles(taxonomy: Taxonomy, mapping: AxisMapping): boolean {
  return mapping.axis === taxonomy.styleAxis() && isIdentityMapping(mapping)
}

export function bucketColor(taxonomy: Taxonomy, mapping: AxisMapping, bucketId: string): string {
  return bucketsStyles(taxonomy, mapping) ? `var(${taxonomy.colorVar(bucketId)})` : NEUTRAL_BUCKET_COLOR
}
