// useHighlight — hover / keyboard-focus / preview-highlight concern for the
// Graph View.
//
// Owns the hover and keyboard-focus state and the control-panel preview state
// (active section / charge / gravity / pull edge), tracks the Shift key, and
// derives the transitive-dependency highlight sets from the active node. The
// selection is the view's (or the host's) and comes in as an input; so do the
// visible subgraph and a `getNode` accessor (the explicit data link to the
// sim). It never touches simRef directly.

import React from 'react'
import type { SimNode } from '../../graph/simulation'
import type { GraphEdge, GraphNode } from '../../graph/model'
import { highlightOf } from '../../graph/highlight'
import type { Taxonomy } from '../../graph/taxonomy'
import { listEqual } from '../../filter/types'
import { ancestry } from './tabOrder'

import type { ForceSection } from '../GraphControlPanel'
import type { GravityHover } from '../GravityControls'

const NO_PATH: readonly string[] = []

export interface HighlightController {
  hoveredNodeId: string | null
  setHoveredNodeId: React.Dispatch<React.SetStateAction<string | null>>
  shiftHeld: boolean
  /** The keyboard focus: the node it holds while that is drawn, else its nearest drawn container. */
  focusedNodeId: string | null
  focusNode: (id: string) => void
  highlightedNodes: Set<string> | null
  highlightedEdges: Set<string> | null
  activeSection: ForceSection
  setActiveSection: React.Dispatch<React.SetStateAction<ForceSection>>
  activePushBucket: string | null
  setActivePushBucket: React.Dispatch<React.SetStateAction<string | null>>
  activeGravityBucket: GravityHover | null
  setActiveGravityBucket: React.Dispatch<React.SetStateAction<GravityHover | null>>
  activePullEdge: string | null
  setActivePullEdge: React.Dispatch<React.SetStateAction<string | null>>
}

export function useHighlight(
  visibleNodes: SimNode[],
  visibleEdges: GraphEdge[],
  visibleIds: Set<string>,
  undirected: ReadonlySet<string>,
  getNode: (id: string) => SimNode | undefined,
  // Changes whenever the underlying graph is rebuilt; clears the hover so a
  // stale id never lingers across graphs.
  resetKey: unknown,
  taxonomy: Taxonomy,
  /** The selected nodes — the view's own or the host's — which the highlight walks from when nothing is hovered. */
  selectedIds: ReadonlySet<string>,
  /** The host's nodes by id: what the taxonomy's `highlight` hook is handed, never the simulation's copies. */
  hostIndex: ReadonlyMap<string, GraphNode>,
): HighlightController {
  const [hoveredNodeId, setHoveredNodeId] = React.useState<string | null>(null)
  // The focus with its containers as they were when it was set: a filter or a
  // reload that stops drawing it moves it to the nearest one still drawn.
  const [focusPath, setFocusPath] = React.useState<readonly string[]>(NO_PATH)
  const [shiftHeld, setShiftHeld] = React.useState(false)

  // Force-field preview (hover-driven; no persistent toggle).
  const [activeSection, setActiveSection] = React.useState<ForceSection>(null)
  const [activePushBucket, setActivePushBucket] = React.useState<string | null>(null)
  const [activeGravityBucket, setActiveGravityBucket] = React.useState<GravityHover | null>(null)
  const [activePullEdge, setActivePullEdge] = React.useState<string | null>(null)

  React.useEffect(() => setHoveredNodeId(null), [resetKey])

  // Shift key tracking — drives upstream vs downstream highlight direction.
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(true) }
    const up = (e: KeyboardEvent) => { if (e.key === 'Shift') setShiftHeld(false) }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])

  const focusedNodeId = focusPath.find(id => visibleIds.has(id)) ?? null
  const focusNode = React.useCallback((id: string) => setFocusPath(ancestry(id, getNode)), [getNode])
  React.useEffect(() => setFocusPath(path => {
    const next = focusedNodeId === null ? NO_PATH : ancestry(focusedNodeId, getNode)
    return listEqual(next, path) ? path : next
  }), [focusedNodeId, visibleIds, getNode])

  // Sister copies are not added: the canvas halos them.
  const { highlightedNodes, highlightedEdges } = React.useMemo(() => {
    // The host's hook sees the host's own nodes: the active ones, the visible
    // ones and any it looks up — the simulation's copies stay the view's.
    const hostNode = (id: string) => hostIndex.get(id) ?? getNode(id)
    const active = [...(hoveredNodeId === null ? selectedIds : [hoveredNodeId])]
      .filter(id => visibleIds.has(id))
      .flatMap(id => hostNode(id) ?? [])
    if (active.length === 0) {
      return { highlightedNodes: null as Set<string> | null, highlightedEdges: null as Set<string> | null }
    }
    const direction = shiftHeld ? 'upstream' as const : 'downstream' as const
    const { nodes, edges } = highlightOf(taxonomy, active, direction, {
      visibleNodes: visibleNodes.map(n => hostIndex.get(n.id) ?? n),
      visibleEdges, visibleIds,
      getNode: hostNode,
    }, undirected)
    return { highlightedNodes: nodes, highlightedEdges: edges }
  }, [hoveredNodeId, selectedIds, shiftHeld, visibleEdges, visibleIds, undirected, visibleNodes, getNode, taxonomy, hostIndex])

  return {
    hoveredNodeId, setHoveredNodeId,
    shiftHeld,
    focusedNodeId, focusNode,
    highlightedNodes, highlightedEdges,
    activeSection, setActiveSection,
    activePushBucket, setActivePushBucket,
    activeGravityBucket, setActiveGravityBucket,
    activePullEdge, setActivePullEdge,
  }
}
