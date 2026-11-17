// Transitive dependency highlighting for graph hover/selection.

import { isContainment } from './model'
import type { GraphEdge, GraphNode } from './model'
import type { Highlight, HighlightGraph, Taxonomy } from './taxonomy'
import { engineOf } from './taxonomy'

import type { HighlightDirection } from './taxonomy'
export type { HighlightDirection } from './taxonomy'

// BFS traversal of dependency edges (not containment) in the given direction,
// an undirected edge in both. Returns the set of transitively connected node
// IDs including the starting node.
export function getTransitiveDeps(
  nodeId: string,
  edges: GraphEdge[],
  visibleIds: Set<string>,
  direction: HighlightDirection,
  undirected: ReadonlySet<string>,
): Set<string> {
  const result = new Set<string>([nodeId])
  const queue = [nodeId]

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const edge of edges) {
      if (isContainment(edge)) continue

      const both = undirected.has(edge.id)
      let next: string | undefined
      if ((both || direction === 'downstream') && edge.sourceId === current) {
        next = edge.targetId
      } else if ((both || direction === 'upstream') && edge.targetId === current) {
        next = edge.sourceId
      }

      if (next && visibleIds.has(next) && !result.has(next)) {
        result.add(next)
        queue.push(next)
      }
    }
  }

  return result
}

// Return edge IDs where both endpoints are in the highlighted node set
// and the edge is a dependency (not containment).
export function getHighlightedEdgeIds(
  highlightedNodes: Set<string>,
  edges: GraphEdge[],
): Set<string> {
  const result = new Set<string>()
  for (const edge of edges) {
    if (isContainment(edge)) continue
    if (highlightedNodes.has(edge.sourceId) && highlightedNodes.has(edge.targetId)) {
      result.add(edge.id)
    }
  }
  return result
}

/**
 * The highlight for an active node: the library's directional walk
 * from it, both ways along an `undirected` edge, handed to the taxonomy's
 * hook to widen or replace, with the lit edges derived from the lit nodes
 * when the hook names none.
 */
export function highlightOf(
  taxonomy: Taxonomy,
  active: GraphNode,
  direction: HighlightDirection,
  graph: HighlightGraph,
  undirected: ReadonlySet<string>,
): { nodes: Set<string>; edges: Set<string> } {
  const walked = getTransitiveDeps(active.id, [...graph.visibleEdges], new Set(graph.visibleIds), direction, undirected)
  const lit: Highlight = engineOf(taxonomy).highlight(active, { nodes: walked }, graph, direction)
  const nodes = new Set(lit.nodes)
  const edges = lit.edges ? new Set(lit.edges) : getHighlightedEdgeIds(nodes, [...graph.visibleEdges])
  return { nodes, edges }
}
