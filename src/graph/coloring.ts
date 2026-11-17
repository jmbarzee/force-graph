import { valuesOn } from './axis'
import type { AxisId, AxisLabels, AxisValue } from './axis'
import { checkedKey, groupSlotsOf, groupsByNode, nodeGroupsOf } from './groups'
import type { GlowSource, Groups, LegendKey } from './groups'
import type { Graph, GraphNode } from './model'
import { cssSuffix, hueOf, pairOf } from './scheme'
import type { Theme, ThemedColor, ThemedHue } from './scheme'
import { namerFor, styleLabelFor } from './simulation'
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
  /** Every key, in slot order, with its legend label, hue and glow weight. */
  keys: ReadonlyMap<string, { label: string; hue: ThemedHue; weight?: number }>
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
 * slot of its place among the keys, so a filter recolours nothing; a group,
 * its `groupSlotsOf` slot. An axis's keys are named as its chips are, through
 * `labels`. The groups' own warnings are `nodeGroupsOf`'s to report.
 */
export function resolveColoring(coloring: SetColoring, graph: Graph, taxonomy: Taxonomy, groups: Groups, labels?: AxisLabels): ResolvedColoring {
  const diagnostics: GraphDiagnostic[] = []
  const keys = new Map<string, { label: string; hue: ThemedHue; weight?: number }>()
  const of = new Map<string, readonly string[]>()
  const declare = (list: readonly LegendKey[]) => {
    for (const k of list) if (!keys.has(k.id)) keys.set(k.id, { label: k.label, hue: hueOf(checkedKey(k, diagnostics).color, keys.size), weight: k.weight })
  }

  if (coloring.by === 'groups') {
    const listed = nodeGroupsOf(groups, graph.nodes).groups
    const slots = groupSlotsOf(listed, graph.edges)
    const labels = new Map('of' in groups ? groups.keys.map(k => [k.id, k.label]) : [])
    listed.forEach((g, i) => {
      if (!keys.has(g.id)) keys.set(g.id, { label: labels.get(g.id) ?? g.id, hue: hueOf(g.color, slots[i]), weight: g.weight })
    })
    const byNode = groupsByNode(listed)
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
      const labelFor = styleLabelFor(taxonomy, labels)
      for (const v of taxonomy.styleValues) {
        if (!present.has(v)) continue
        const { color } = taxonomy.styleOf(v)
        keys.set(v, { label: labelFor(v), hue: { light: color.light.fill, dark: color.dark.fill } })
      }
    } else {
      const values = valuesOn(graph.nodes, axis)
      const descriptor = taxonomy.axisFor(axis)
      const { labelFor } = namerFor(taxonomy, axis, labels)
      const ordered: readonly AxisValue[] = descriptor ? descriptor.chipsFor(values).flatMap(c => c.values) : values
      declare(ordered.map(v => ({ id: v, label: labelFor(v) })))
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

/** Whether two colourings say the same: `by`, `axis`, `keys` by id, label, colour and weight, and `of` by identity. */
export function coloringsEqual(a: SetColoring | undefined, b: SetColoring | undefined): boolean {
  if (a === b) return true
  if (!a || !b || a.by !== b.by) return false
  if (a.by === 'groups') return true
  if (!keysEqual(a.keys, (b as Coloring).keys)) return false
  return a.by === 'axis' ? a.axis === (b as typeof a).axis : a.of === (b as typeof a).of
}

const keysEqual = (a: readonly LegendKey[] | undefined, b: readonly LegendKey[] | undefined): boolean =>
  a === b || (!!a && !!b && a.length === b.length && a.every((k, i) => k.id === b[i].id && k.label === b[i].label && colorsEqual(k.color, b[i].color) && k.weight === b[i].weight))

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
 * a body's fill and border. Keys are named through `labels`.
 */
export function fillOf(coloring: Coloring | undefined, graph: Graph, taxonomy: Taxonomy, labels?: AxisLabels): Fill {
  const styleAxis = taxonomy.styleAxis()
  if (!coloring || (coloring.by === 'axis' && coloring.axis === styleAxis && !coloring.keys)) {
    const labelFor = styleLabelFor(taxonomy, labels)
    const keys = new Map(taxonomy.styleValues.map(v => [v, { label: labelFor(v), color: taxonomy.styleOf(v).color, cssVar: taxonomy.colorVar(v) }]))
    const of = new Map<string, string>()
    for (const node of graph.nodes) {
      const v = node.values[styleAxis]
      if (v !== undefined && keys.has(v)) of.set(node.id, v)
    }
    return { axis: styleAxis, keys, of, diagnostics: [] }
  }
  const resolved = resolveColoring(coloring, graph, taxonomy, [], labels)
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

/** A node's hue: its first key's, else undefined. Allocates nothing, for the draw loop. */
export function hueFor(coloring: ResolvedColoring, id: string): ThemedHue | undefined {
  const key = coloring.of.get(id)?.[0]
  return key === undefined ? undefined : coloring.keys.get(key)?.hue
}

/**
 * What the glow follows: one source per key of a set colouring, its members
 * the nodes holding the key, coloured by the key's hue, named by its label
 * and swelling by its weight. Absent, the colouring is the groups.
 */
export function glowOf(coloring: SetColoring = { by: 'groups' }, graph: Graph, taxonomy: Taxonomy, groups: Groups, labels?: AxisLabels): { sources: readonly GlowSource[]; diagnostics: readonly GraphDiagnostic[] } {
  const { keys, of, diagnostics } = resolveColoring(coloring, graph, taxonomy, groups, labels)
  const members = new Map([...keys.keys()].map(k => [k, new Set<string>()]))
  for (const [id, held] of of) for (const k of held) members.get(k)!.add(id)
  return { sources: [...keys].map(([id, { label, hue, weight }]) => ({ id, label, nodeIds: members.get(id)!, color: hue, weight })), diagnostics }
}

/** One key of a colour channel as drawn. */
export interface ChannelKey {
  /** The key's id: a value, a group, or what a host function answers. */
  id: string
  /** The key's name, as the chips and the hover box give it. */
  label: string
  /** The key's colour in the pane's theme. */
  color: string
  /** Whether a visible node wears the key. */
  visible: boolean
}

/** Each colour channel's keys as drawn, in slot order; a channel that colours by nothing is absent. */
export interface ColorChannels {
  /** The body's fill. */
  fill?: readonly ChannelKey[]
  /** The glow. */
  glow?: readonly ChannelKey[]
  /** The ring. */
  ring?: readonly ChannelKey[]
}

/**
 * Each channel's keys as drawn in `theme`, visible while a node of
 * `visibleIds` wears them. The fill is always present; the glow and the ring
 * when given.
 */
export function colorChannels(fill: Fill, glow: readonly GlowSource[] | undefined, ring: ResolvedColoring | null, visibleIds: ReadonlySet<string>, theme: Theme): ColorChannels {
  const worn = (keysOf: (id: string) => readonly string[] | undefined) => {
    const out = new Set<string>()
    for (const id of visibleIds) for (const key of keysOf(id) ?? NONE) out.add(key)
    return out
  }
  const fillWorn = worn(id => { const key = fill.of.get(id); return key === undefined ? undefined : [key] })
  const ringWorn = ring && worn(id => ring.of.get(id))
  return {
    fill: [...fill.keys].map(([id, { label, color }]) => ({ id, label, color: color[theme].fill, visible: fillWorn.has(id) })),
    glow: glow?.map(({ id, label, color, nodeIds }) => ({ id, label, color: color[theme], visible: [...nodeIds].some(n => visibleIds.has(n)) })),
    ring: ring ? [...ring.keys].map(([id, { label, hue }]) => ({ id, label, color: hue[theme], visible: ringWorn!.has(id) })) : undefined,
  }
}
