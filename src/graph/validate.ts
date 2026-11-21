// Graph validation — every defect a host's graph can carry, named before the
// view builds anything from it.
//
// A dangling endpoint, an edge whose relation is neither of the two the engine
// knows, an edge the host's rule classifies as a type its table does not
// declare: each is a diagnostic, as data, never a throw from inside a render.
// The view runs this once per graph, shows the list inside its own pane, hands
// it to `onDiagnostics`, and draws what remains; a host that wants to refuse a
// bad graph before mounting calls it itself.

import type { AxisValue } from './axis'
import type { Fill } from './coloring'
import type { Graph, GraphEdge, GraphNode } from './model'
import { nodesById, relationOf, seriesOf, unitWeight, windowOf, withContainmentEdges } from './model'
import type { Taxonomy } from './taxonomy'
import { engineOf } from './taxonomy'

/**
 * The defects `validateGraph` names. Errors: a node or edge id used twice,
 * an edge whose endpoint is not in the graph, an unknown relation, a type
 * whose relation is not the edge's, a rule that threw, a parent not in the
 * graph, a cycle of parents. Warnings: an edge no type claims, an edge
 * weight outside `[0, 1]` or not finite, a window that is not one, an edge
 * series that does not read against the window, a style value the taxonomy
 * does not declare, containment edges that contradict `parentId`,
 * containment edges derived from `parentId` that no type claims
 * (`containment-untyped`). The view adds five of its own, through
 * `onDiagnostics`: a key a colouring or the groups do not declare
 * (`key-undeclared`), a key or group colour outside the scheme's forms
 * (`key-color-invalid`), a chip tint naming no key of the fill
 * (`tint-undeclared`), a layout scalar's answer not finite or outside
 * [0, 1] (`scalar-answer-refused`), and a layout scalar that threw
 * (`scalar-compute-threw`).
 */
export type GraphDiagnosticCode =
  | 'edge-id-duplicate'
  | 'edge-endpoint-missing'
  | 'edge-relation-unknown'
  | 'edge-type-rule-threw'
  | 'edge-type-unclassified'
  | 'edge-type-relation-mismatch'
  | 'edge-weight-invalid'
  | 'window-invalid'
  | 'edge-series-invalid'
  | 'parent-missing'
  | 'parent-cycle'
  | 'containment-parent-mismatch'
  | 'node-value-undeclared'
  | 'node-id-duplicate'
  | 'containment-untyped'
  | 'key-undeclared'
  | 'key-color-invalid'
  | 'tint-undeclared'
  | 'scalar-answer-refused'
  | 'scalar-compute-threw'

/** One defect in a host's graph, as data. */
export interface GraphDiagnostic {
  /** An error names something the view cannot draw as given; a warning, something it draws but the host should know. */
  severity: 'error' | 'warning'
  /** Which defect, stable for a host to match on. */
  code: GraphDiagnosticCode
  /** The defect in words, for a person. */
  message: string
  /** The node the defect names, if any. */
  nodeId?: string
  /** The edge the defect names, if any. */
  edgeId?: string
}

const RELATIONS = new Set(['containment', 'dependency'])

/**
 * Every defect in a host's graph, as data: errors for what the view cannot
 * draw as given (a duplicated node id, a dangling endpoint, an unknown
 * relation, a type whose relation is not the edge's, a parent not in the
 * graph, a cycle of parents) and warnings for what it draws but the host
 * should know (an unclassified edge, an invalid weight, window or series,
 * an undeclared style value, containment edges that contradict `parentId`,
 * a derived containment edge no type claims). Pure; the same graph and
 * taxonomy give the same list, in graph order.
 */
export function validateGraph(graph: Graph, taxonomy: Taxonomy): GraphDiagnostic[] {
  const out: GraphDiagnostic[] = []
  const declaredTypes = new Map(taxonomy.edgeTypes().map(e => [e.id, e]))
  const declaredValues = new Set(taxonomy.styleValues())
  const engine = engineOf(taxonomy)
  const byId = nodesById(graph.nodes)
  const window = windowOf(graph)
  if (graph.window !== undefined && !window) {
    out.push({ severity: 'warning', code: 'window-invalid', message: `the graph's window ${JSON.stringify(graph.window)} is not one: it needs finite bounds, since before until, and a positive whole number of buckets; every series is ignored` })
  }

  // Nodes: one per id, a parent that exists, a style value the taxonomy
  // declares.
  const seenNodes = new Set<string>()
  for (const node of graph.nodes) {
    if (seenNodes.has(node.id)) {
      out.push({ severity: 'error', code: 'node-id-duplicate', nodeId: node.id, message: `node id ${JSON.stringify(node.id)} is used more than once; the view draws the first` })
      continue
    }
    seenNodes.add(node.id)
    if (node.parentId !== undefined && !byId.has(node.parentId)) {
      out.push({ severity: 'error', code: 'parent-missing', nodeId: node.id, message: `node ${JSON.stringify(node.id)} names parent ${JSON.stringify(node.parentId)}, which is not in the graph` })
    }
    const value = engine.styleValueOf(node)
    if (value !== undefined && !declaredValues.has(value)) {
      out.push({ severity: 'warning', code: 'node-value-undeclared', nodeId: node.id, message: `node ${JSON.stringify(node.id)} sits at ${JSON.stringify(value)} on the style axis, which the taxonomy does not declare; it draws in the fallback style` })
    }
  }

  out.push(...parentCycles(byId))

  // Edges: unique ids, both ends present, a known relation, a type (when one
  // classifies) whose relation is the edge's.
  const seenIds = new Set<string>()
  const containers = new Map<string, Set<string>>()
  for (const edge of graph.edges) {
    if (seenIds.has(edge.id)) {
      out.push({ severity: 'error', code: 'edge-id-duplicate', edgeId: edge.id, message: `edge id ${JSON.stringify(edge.id)} is used more than once` })
      continue
    }
    seenIds.add(edge.id)
    const src = byId.get(edge.sourceId)
    const tgt = byId.get(edge.targetId)
    if (!src || !tgt) {
      const missing = [!src && edge.sourceId, !tgt && edge.targetId].filter((x): x is string => typeof x === 'string')
      out.push({ severity: 'error', code: 'edge-endpoint-missing', edgeId: edge.id, message: `edge ${JSON.stringify(edge.id)} names ${missing.map(m => JSON.stringify(m)).join(' and ')}, not in the graph` })
      continue
    }
    if (edge.relation !== undefined && !RELATIONS.has(edge.relation)) {
      out.push({ severity: 'error', code: 'edge-relation-unknown', edgeId: edge.id, message: `edge ${JSON.stringify(edge.id)} has relation ${JSON.stringify(edge.relation)}; the engine knows "containment" and "dependency"` })
      continue
    }
    const relation = relationOf(edge)
    if (relation === 'containment') {
      const set = containers.get(edge.sourceId) ?? new Set<string>()
      set.add(edge.targetId)
      containers.set(edge.sourceId, set)
    }
    if (edge.weight !== undefined && unitWeight(edge) !== edge.weight) {
      out.push({ severity: 'warning', code: 'edge-weight-invalid', edgeId: edge.id, message: `edge ${JSON.stringify(edge.id)} has weight ${String(edge.weight)}, which is not a weight in [0, 1]; the view clamps it, and draws one not finite as no weight` })
    }
    if (edge.series !== undefined && !seriesOf(edge, window)) {
      const why = window ? `one finite count of at least 0 for each of the window's ${window.buckets} buckets` : 'a valid window on the graph'
      out.push({ severity: 'warning', code: 'edge-series-invalid', edgeId: edge.id, message: `edge ${JSON.stringify(edge.id)} has a series that needs ${why}; it draws as having none` })
    }
    let typeId: string | undefined
    try {
      typeId = engine.edgeTypeOf(edge, engine.styleValueOf(src), engine.styleValueOf(tgt))
    } catch (e) {
      out.push({ severity: 'error', code: 'edge-type-rule-threw', edgeId: edge.id, message: `the taxonomy's classifyEdge rule threw on edge ${JSON.stringify(edge.id)}: ${e instanceof Error ? e.message : String(e)}` })
      continue
    }
    const declared = typeId === undefined ? undefined : declaredTypes.get(typeId)
    if (!declared) {
      const said = typeId === undefined ? 'no declared type fits its endpoints and values' : `classifyEdge answered ${JSON.stringify(typeId)}, which edgeTypes does not declare`
      out.push({ severity: 'warning', code: 'edge-type-unclassified', edgeId: edge.id, message: `edge ${JSON.stringify(edge.id)} has no type: ${said}; it draws in its relation's default stroke and springs with the middling spring` })
      continue
    }
    if (declared.relation !== relation) {
      out.push({ severity: 'error', code: 'edge-type-relation-mismatch', edgeId: edge.id, message: `edge ${JSON.stringify(edge.id)} is a ${relation} edge but resolves to type ${JSON.stringify(typeId)}, declared as ${declared.relation}` })
    }
  }

  // The two readings of containment agree: a node that lists containment
  // edges of its own lists one to its parent. A node listing none gets that
  // edge derived from `parentId`; a node with no parent may list what it likes.
  for (const node of byId.values()) {
    const viaEdges = containers.get(node.id)
    if (node.parentId !== undefined && viaEdges !== undefined && !viaEdges.has(node.parentId)) {
      out.push({ severity: 'warning', code: 'containment-parent-mismatch', nodeId: node.id, message: `node ${JSON.stringify(node.id)} has containment edges to ${[...viaEdges].map(c => JSON.stringify(c)).join(' and ')} but its parentId is ${JSON.stringify(node.parentId)}` })
    }
  }
  out.push(...derivedContainmentDiagnostics(withContainmentEdges(dropInvalid(graph, out)), graph, taxonomy))
  return out
}

/**
 * One error per cycle of `parentId`s, naming its nodes from the first in graph
 * order, which `dropInvalid` orphans so containment is a tree.
 */
function parentCycles(byId: ReadonlyMap<string, GraphNode>): GraphDiagnostic[] {
  const done = new Set<string>()
  const onCycle = new Set<string>()
  for (const start of byId.keys()) {
    const path: string[] = []
    const pos = new Map<string, number>()
    let id: string | undefined = start
    while (id !== undefined && byId.has(id) && !done.has(id)) {
      const at = pos.get(id)
      if (at !== undefined) {
        for (const c of path.slice(at)) onCycle.add(c)
        break
      }
      pos.set(id, path.length)
      path.push(id)
      id = byId.get(id)!.parentId
    }
    for (const p of path) done.add(p)
  }
  const out: GraphDiagnostic[] = []
  const named = new Set<string>()
  for (const first of byId.keys()) {
    if (!onCycle.has(first) || named.has(first)) continue
    const cycle = [first]
    for (let id = byId.get(first)!.parentId!; id !== first; id = byId.get(id)!.parentId!) cycle.push(id)
    for (const c of cycle) named.add(c)
    out.push({ severity: 'error', code: 'parent-cycle', nodeId: first, message: `parentId runs in a cycle: ${[...cycle, first].map(c => JSON.stringify(c)).join(' → ')}; the view clears ${JSON.stringify(first)}'s parent` })
  }
  return out
}

/**
 * The graph with every node and edge an error names removed and every parent
 * an error names cleared — what the view draws when the host's graph has
 * defects. A duplicated id keeps its first node and its first edge. The
 * host's objects are not mutated; a graph with no errors is returned as is.
 */
export function dropInvalid(graph: Graph, diagnostics: readonly GraphDiagnostic[]): Graph {
  const badEdges = new Set<string>()
  const badParents = new Set<string>()
  const duplicateNodes = new Set<string>()
  for (const d of diagnostics) {
    if (d.severity !== 'error') continue
    if (d.edgeId !== undefined) badEdges.add(d.edgeId)
    if ((d.code === 'parent-missing' || d.code === 'parent-cycle') && d.nodeId !== undefined) badParents.add(d.nodeId)
    if (d.code === 'node-id-duplicate' && d.nodeId !== undefined) duplicateNodes.add(d.nodeId)
  }
  if (badEdges.size === 0 && badParents.size === 0 && duplicateNodes.size === 0) return graph
  const seenNodes = new Set<string>()
  const nodes: GraphNode[] = []
  for (const node of graph.nodes) {
    if (duplicateNodes.has(node.id) && seenNodes.has(node.id)) continue
    seenNodes.add(node.id)
    nodes.push(badParents.has(node.id) ? { ...node, parentId: undefined } : node)
  }
  // A duplicated id names every edge carrying it; the first keeps its place.
  const kept = new Set<string>()
  const edges: GraphEdge[] = []
  for (const e of graph.edges) {
    if (badEdges.has(e.id) && kept.has(e.id)) continue
    if (badEdges.has(e.id) && !diagnostics.some(d => d.edgeId === e.id && d.code === 'edge-id-duplicate')) continue
    kept.add(e.id)
    edges.push(e)
  }
  return { ...graph, nodes, edges }
}

/**
 * The containment edges derived from `parentId` that no declared containment
 * type claims (a dependency type the host's rule answers does not count). They draw in
 * the containment stroke and spring with the middling spring; a host that
 * wants them typed declares a containment type between the child's value and
 * the parent's.
 */
function derivedContainmentDiagnostics(drawn: Graph, host: Graph, taxonomy: Taxonomy): GraphDiagnostic[] {
  const listed = new Set<GraphEdge>(host.edges)
  const byId = nodesById(drawn.nodes)
  const engine = engineOf(taxonomy)
  const untyped: string[] = []
  for (const edge of drawn.edges) {
    if (listed.has(edge) || relationOf(edge) !== 'containment') continue
    const src = byId.get(edge.sourceId)
    const tgt = byId.get(edge.targetId)
    let typeId: string | undefined
    try {
      typeId = engine.edgeTypeOf(edge, src && engine.styleValueOf(src), tgt && engine.styleValueOf(tgt))
    } catch {
      typeId = undefined
    }
    const declared = typeId === undefined ? undefined : taxonomy.edgeTypes().find(t => t.id === typeId)
    if (declared === undefined || declared.relation !== 'containment') untyped.push(edge.id)
  }
  if (untyped.length === 0) return []
  const shown = untyped.slice(0, 3).map(id => JSON.stringify(id)).join(', ')
  const one = untyped.length === 1
  return [{
    severity: 'warning',
    code: 'containment-untyped',
    edgeId: untyped[0],
    message: `${untyped.length} derived containment edge${one ? '' : 's'} (${shown}${untyped.length > 3 ? ', …' : ''}) ${one ? 'has' : 'have'} no type: no declared containment type runs between the child's value and the parent's; ${one ? 'it draws' : 'they draw'} in the containment stroke and spring${one ? 's' : ''} with the middling spring`,
  }]
}

/** Every chip, over each declared axis's values, whose tint names no key of the fill: once per chip. */
export function tintDiagnostics(taxonomy: Taxonomy, values: ReadonlyMap<string, readonly AxisValue[]>, fill: Fill): GraphDiagnostic[] {
  const out: GraphDiagnostic[] = []
  for (const axis of taxonomy.filterAxes()) {
    for (const chip of axis.chipsFor(values.get(axis.id) ?? [])) {
      if (chip.tint === undefined || fill.keys.has(chip.tint)) continue
      out.push({ severity: 'warning', code: 'tint-undeclared', message: `chip ${JSON.stringify(chip.id)} on ${JSON.stringify(axis.id)} wears ${JSON.stringify(chip.tint)}, which the fill's keys do not declare; it draws neutral` })
    }
  }
  return out
}
