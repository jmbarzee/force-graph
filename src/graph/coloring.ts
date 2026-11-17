import { valuesOn } from './axis'
import type { AxisId, AxisValue } from './axis'
import { checkedKey, groupsByNode, nodeGroupsOf } from './groups'
import type { Groups, LegendKey } from './groups'
import type { Graph, GraphNode } from './model'
import { cssSuffix, hueOf, pairOf } from './scheme'
import type { ThemedColor, ThemedHue } from './scheme'
import type { Taxonomy } from './taxonomy'
import type { GraphDiagnostic } from './validate'

/** Where a one-key channel's colours come from: a node's value on an axis, or the key a host function answers. */
export type Coloring =
  | { by: 'axis'; axis: AxisId; keys?: readonly LegendKey[] }
  | { by: 'node'; keys: readonly LegendKey[]; of: (node: GraphNode) => string | undefined }

/** Where a many-key channel's colours come from: a one-key colouring, or the view's groups. */
export type SetColoring = Coloring | { by: 'groups' }

/** A colouring over one graph. */
export interface ResolvedColoring {
  /** Every key, in slot order, with its legend label and hue. */
  keys: ReadonlyMap<string, { label: string; hue: ThemedHue }>
  /** Every node's keys, by node id; a keyless node's is empty. */
  of: ReadonlyMap<string, readonly string[]>
  /** `key-color-invalid` once per key, `key-undeclared` once per answered key no key declares. */
  diagnostics: readonly GraphDiagnostic[]
}

const NONE: readonly string[] = Object.freeze([])

/**
 * Each node's keys and each key's hue. Declared keys win; an axis without
 * them takes its values across the graph in its chips' order, or the style
 * axis's declared order and fills. A key with no colour takes the palette
 * slot of its place among the keys, so a filter recolours nothing.
 */
export function resolveColoring(coloring: SetColoring, graph: Graph, taxonomy: Taxonomy, groups: Groups): ResolvedColoring {
  const diagnostics: GraphDiagnostic[] = []
  const keys = new Map<string, { label: string; hue: ThemedHue }>()
  const of = new Map<string, readonly string[]>()
  const declare = (list: readonly LegendKey[]) => {
    for (const k of list) if (!keys.has(k.id)) keys.set(k.id, { label: k.label, hue: hueOf(checkedKey(k, diagnostics).color, keys.size) })
  }

  if (coloring.by === 'groups') {
    const listed = nodeGroupsOf(groups, graph.nodes)
    diagnostics.push(...listed.diagnostics)
    const labels = new Map('of' in groups ? groups.keys.map(k => [k.id, k.label]) : [])
    declare(listed.groups.map(g => ({ id: g.id, label: labels.get(g.id) ?? g.id, color: g.color })))
    const byNode = groupsByNode(listed.groups)
    for (const node of graph.nodes) of.set(node.id, byNode.get(node.id) ?? NONE)
    return { keys, of, diagnostics }
  }

  let keyOf: (node: GraphNode) => string | undefined
  if (coloring.by === 'node') {
    declare(coloring.keys)
    keyOf = coloring.of
  } else {
    const { axis } = coloring
    keyOf = n => n.values[axis]
    if (coloring.keys) declare(coloring.keys)
    else if (axis === taxonomy.styleAxis()) {
      const present = new Set(valuesOn(graph.nodes, axis))
      const labelFor = taxonomy.axisFor(axis)?.labelFor
      for (const v of taxonomy.styleValues) {
        if (!present.has(v)) continue
        const { label, color } = taxonomy.styleOf(v)
        keys.set(v, { label: labelFor?.(v) ?? label, hue: { light: color.light.fill, dark: color.dark.fill } })
      }
    } else {
      const values = valuesOn(graph.nodes, axis)
      const descriptor = taxonomy.axisFor(axis)
      const ordered: readonly AxisValue[] = descriptor ? descriptor.chipsFor(values).flatMap(c => c.values) : values
      declare(ordered.map(v => ({ id: v, label: descriptor?.labelFor(v) ?? v })))
    }
  }

  const single = new Map([...keys.keys()].map(k => [k, Object.freeze([k])]))
  const undeclared = new Set<string>()
  for (const node of graph.nodes) {
    const key = keyOf(node)
    of.set(node.id, (key !== undefined && single.get(key)) || NONE)
    if (coloring.by === 'node' && key !== undefined && !keys.has(key) && !undeclared.has(key)) {
      undeclared.add(key)
      diagnostics.push({ severity: 'warning', code: 'key-undeclared', nodeId: node.id, message: `node ${JSON.stringify(node.id)} has key ${JSON.stringify(key)}, which the colouring's keys do not declare; the view colours it by none` })
    }
  }
  return { keys, of, diagnostics }
}

/** Whether two colourings say the same: `by`, `axis`, `keys` by id, label and colour, and `of` by identity. */
export function coloringsEqual(a: Coloring | undefined, b: Coloring | undefined): boolean {
  if (a === b) return true
  if (!a || !b || a.by !== b.by || !keysEqual(a.keys, b.keys)) return false
  return a.by === 'axis' ? a.axis === (b as typeof a).axis : a.of === (b as typeof a).of
}

const keysEqual = (a: readonly LegendKey[] | undefined, b: readonly LegendKey[] | undefined): boolean =>
  a === b || (!!a && !!b && a.length === b.length && a.every((k, i) => k.id === b[i].id && k.label === b[i].label && colorsEqual(k.color, b[i].color)))

const colorsEqual = (a: LegendKey['color'], b: LegendKey['color']): boolean =>
  a === b || (typeof a === 'object' && typeof b === 'object' && a.light === b.light && a.dark === b.dark)

/** A node's fill: each key's label, colour and custom property, and each node's key. */
export interface Fill {
  /** The axis the fill follows; undefined when a host function answers each node's key. */
  axis: AxisId | undefined
  /** Every key, in slot order, with its legend label, colour, and the custom property its fill is published under (`-border` for its border). */
  keys: ReadonlyMap<string, { label: string; color: ThemedColor; cssVar: string }>
  /** Each keyed node's key, by node id. */
  of: ReadonlyMap<string, string>
  /** What resolving the colouring reported. */
  diagnostics: readonly GraphDiagnostic[]
}

/**
 * The fill a colouring gives a graph. Absent, or the style axis without
 * keys, it is every declared style's own colour; otherwise each key's hue as
 * a body's fill and border.
 */
export function fillOf(coloring: Coloring | undefined, graph: Graph, taxonomy: Taxonomy): Fill {
  const styleAxis = taxonomy.styleAxis()
  if (!coloring || (coloring.by === 'axis' && coloring.axis === styleAxis && !coloring.keys)) {
    const labelFor = taxonomy.axisFor(styleAxis)?.labelFor
    const keys = new Map(taxonomy.styleValues.map(v => {
      const { label, color } = taxonomy.styleOf(v)
      return [v, { label: labelFor?.(v) ?? label, color, cssVar: taxonomy.colorVar(v) }]
    }))
    const of = new Map<string, string>()
    for (const node of graph.nodes) {
      const v = node.values[styleAxis]
      if (v !== undefined && keys.has(v)) of.set(node.id, v)
    }
    return { axis: styleAxis, keys, of, diagnostics: [] }
  }
  const resolved = resolveColoring(coloring, graph, taxonomy, [])
  const cssVar = cssVarsFor([...resolved.keys.keys()])
  const keys = new Map([...resolved.keys].map(([id, { label, hue }]) => [id, { label, color: pairOf(hue), cssVar: cssVar.get(id)! }]))
  const of = new Map<string, string>()
  for (const [id, [key]] of resolved.of) if (key !== undefined) of.set(id, key)
  return { axis: coloring.by === 'axis' ? coloring.axis : undefined, keys, of, diagnostics: resolved.diagnostics }
}

/**
 * Each key's custom property: `--gv-node-` and the key in kebab case,
 * numbered from 2 where an earlier key took the name (`c`, `c-2`), and
 * `k<slot>` where it kebab-cases to nothing.
 */
function cssVarsFor(keys: readonly string[]): Map<string, string> {
  const taken = new Set<string>()
  return new Map(keys.map((key, slot) => {
    const stem = cssSuffix(key) || `k${slot + 1}`
    let name = stem
    for (let n = 2; taken.has(name); n++) name = `${stem}-${n}`
    taken.add(name)
    return [key, `--gv-node-${name}`]
  }))
}

/** A node's fill and border: its key's, else `fallback`. Allocates nothing, for the draw loop. */
export function pairFor(fill: Fill, id: string, fallback: ThemedColor): ThemedColor {
  const key = fill.of.get(id)
  return (key !== undefined && fill.keys.get(key)?.color) || fallback
}
