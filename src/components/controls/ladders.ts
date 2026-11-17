// Ladders on a control surface: style values sharing a `ladder` id, set apart
// where a control buckets the style axis by identity, and collapsible to one
// row that tunes every rung alike. A collapsed row writes one ordinary
// override per rung, so the tuning never learns ladders exist.

import type { AxisMapping } from '../../graph/axis'
import type { Taxonomy } from '../../graph/taxonomy'
import { bucketsStyles } from './bucketColor'

/** A ladder as drawn: its id and its shown rungs, in declaration order. */
export interface Ladder {
  id: string
  rungs: readonly string[]
}

/** One row of a surface: a bucket alone, or a ladder expanded or collapsed. */
export type Row =
  | { kind: 'bucket'; id: string }
  | { kind: 'ladder'; ladder: Ladder; collapsed: boolean }

/** The ladders `mapping` draws over the `shown` buckets: two or more rungs on screen, else none. */
export function laddersOn(taxonomy: Taxonomy, mapping: AxisMapping, shown: readonly string[]): Ladder[] {
  if (!bucketsStyles(taxonomy, mapping)) return []
  const on = new Set(shown)
  const rungs = new Map<string, string[]>()
  for (const v of taxonomy.styleValues) {
    const id = taxonomy.styleOf(v).ladder
    if (id === undefined || !on.has(v)) continue
    rungs.set(id, [...(rungs.get(id) ?? []), v])
  }
  return [...rungs].filter(([, r]) => r.length >= 2).map(([id, r]) => ({ id, rungs: r }))
}

/** The rows `shown` makes: a ladder sits where its first shown rung would, its later rungs with it. */
export function rowsOf(shown: readonly string[], ladders: readonly Ladder[], collapsed: ReadonlySet<string>): Row[] {
  const ladderOf = new Map(ladders.flatMap(l => l.rungs.map(r => [r, l] as const)))
  const rows: Row[] = []
  const placed = new Set<string>()
  for (const id of shown) {
    const ladder = ladderOf.get(id)
    if (ladder === undefined) rows.push({ kind: 'bucket', id })
    else if (!placed.has(ladder.id)) {
      placed.add(ladder.id)
      rows.push({ kind: 'ladder', ladder, collapsed: collapsed.has(ladder.id) })
    }
  }
  return rows
}

/** One rung's value and the range it must stay in. */
export interface Bound {
  value: number
  lo: number
  hi: number
}

/** `delta`, clamped so every value moved by it stays in its own range. */
export function alikeShift(delta: number, bounds: readonly Bound[]): number {
  const lo = Math.max(...bounds.map(b => b.lo - b.value))
  const hi = Math.min(...bounds.map(b => b.hi - b.value))
  return Math.max(lo, Math.min(hi, delta))
}
