// Group overlay — the glow groups the Graph view draws. A host hands the view
// groups over the WHOLE graph: either derived, keys it declares and a function
// answering each node's keys, or listed, an id and the node ids each covers.
// The view settles membership and palette slots once per graph and groups,
// then restricts each group to the visible set on every render and drops the
// empty — so a group keeps its colour when a filter hides others. What a
// group IS — the host's chunking, what the user has drilled into — is the
// host's.

import type { GraphEdge, GraphNode } from './model'
import type { Theme } from './scheme'
import type { GraphDiagnostic } from './validate'

// A small cycling palette per theme. Identity is carried by the host's legend,
// so colours only need to separate the handful of sibling groups shown at
// once — not be globally unique. The light set is the same ten hues a few
// stops deeper, so a glow reads on a pale canvas.
/** The cycling glow palette per theme; a group with no `color` of its own takes a slot by `groupSlotsOf`. */
export const GROUP_PALETTE: Readonly<Record<Theme, readonly string[]>> = {
  dark: [
    '#2DD4BF', // teal
    '#F59E0B', // amber
    '#A78BFA', // violet
    '#F472B6', // rose
    '#34D399', // green
    '#60A5FA', // blue
    '#FB923C', // orange
    '#A3E635', // lime
    '#22D3EE', // cyan
    '#E879F9', // fuchsia
  ],
  light: [
    '#0F766E', // teal
    '#B45309', // amber
    '#6D28D9', // violet
    '#BE185D', // rose
    '#047857', // green
    '#1D4ED8', // blue
    '#C2410C', // orange
    '#4D7C0F', // lime
    '#0E7490', // cyan
    '#A21CAF', // fuchsia
  ],
}

// Glow intensity multiplier for a group the host emphasises (`NodeGroup
// .emphasized`: hovered in its legend, vs. the default 1). Drives both
// brightness and — since the canvas swells focused groups — halo/corridor size.
const HOVER_STRENGTH = 2.2

// Glow intensity multiplier for the group that contains the node currently
// hovered/selected on the canvas. This is the antidote to "tons of groups": with
// many faint groups shown at once, moving over the graph makes the group under
// the pointer surface, so the user can read which group any node belongs to
// without hunting in the legend. It brightens *and* swells the group's glow
// (see GROUP_GLOW_FOCUS_SWELL in GraphCanvas) so it clearly lifts out of the field.
/** The glow strength of the group holding the hovered or selected node. */
export const NODE_FOCUS_STRENGTH = 2.2

/** A group as the host asks for it: over the whole graph, visible or not. */
export interface NodeGroup {
  /** Unique among the host's groups. */
  id: string
  /** The nodes in the group, visible or not. */
  nodeIds: ReadonlySet<string>
  /** Whether the host emphasises this group; the view glows it stronger. A host's legend inside the pane uses `groupsControl`'s `emphasize` instead and leaves this out. */
  emphasized?: boolean
  /** The glow's colour, hex or rgb(); absent, a palette slot no group joined to it by an edge holds. */
  color?: string
  /** 0..1: how far the glow's halo and corridor swell; absent, they do not. */
  weight?: number
}

/** One key of a set-shaped channel, in the order its palette slots follow. */
export interface LegendKey {
  /** What `of` answers for a node in this key's group. */
  id: string
  /** The key's name in a legend. */
  label: string
  /** The key's colour, hex or rgb(); absent, a palette slot no key joined to it by an edge holds. */
  color?: string
  /** 0..1: how far the key's glow swells; absent, it does not. */
  weight?: number
}

/**
 * Groups derived from the data: the keys the host declares, and the keys each
 * node belongs to. Slots follow `keys`, never the visible set; a key `of`
 * answers that `keys` does not declare is ignored and reported.
 */
export interface DerivedGroups {
  /** Every key, in palette order. */
  keys: readonly LegendKey[]
  /** The keys a node belongs to, by `id`. */
  of: (node: GraphNode) => readonly string[]
}

/** The groups a host hands the view: derived from the data, or listed. */
export type Groups = readonly NodeGroup[] | DerivedGroups

const NO_DIAGNOSTICS: readonly GraphDiagnostic[] = []

/**
 * The listed form of `groups` over `nodes`, and a `group-key-undeclared`
 * warning per key `of` answers that `keys` does not declare. A listed form
 * comes back as given; no warnings come back as one shared empty list.
 */
export function nodeGroupsOf(groups: Groups, nodes: readonly GraphNode[]): { groups: readonly NodeGroup[]; diagnostics: readonly GraphDiagnostic[] } {
  if (!('of' in groups)) return { groups, diagnostics: NO_DIAGNOSTICS }
  const listed = groups.keys.map(k => ({ id: k.id, nodeIds: new Set<string>(), color: k.color, weight: k.weight }))
  const members = new Map(listed.map(g => [g.id, g.nodeIds]))
  const diagnostics: GraphDiagnostic[] = []
  const undeclared = new Set<string>()
  for (const node of nodes) {
    for (const key of groups.of(node)) {
      const ids = members.get(key)
      if (ids) ids.add(node.id)
      else if (!undeclared.has(key)) {
        undeclared.add(key)
        diagnostics.push({ severity: 'warning', code: 'group-key-undeclared', nodeId: node.id, message: `node ${JSON.stringify(node.id)} belongs to group ${JSON.stringify(key)}, which the groups' keys do not declare; the view ignores it` })
      }
    }
  }
  return { groups: listed, diagnostics: diagnostics.length ? diagnostics : NO_DIAGNOSTICS }
}

/**
 * Each group's palette slot, over the whole graph: in list order, the group's
 * own place in the palette, or the next one no earlier group joined to it by
 * an edge holds; its own place again once every slot is held. Never reads the
 * visible set, so a filter recolours nothing.
 */
export function groupSlotsOf(groups: readonly NodeGroup[], edges: readonly GraphEdge[]): number[] {
  const size = GROUP_PALETTE.dark.length
  const groupsOf = new Map<string, number[]>()
  groups.forEach((g, i) => {
    for (const id of g.nodeIds) {
      const of = groupsOf.get(id) ?? []
      if (of.length === 0) groupsOf.set(id, of)
      of.push(i)
    }
  })
  const joined = groups.map(() => new Set<number>())
  for (const e of edges) {
    for (const a of groupsOf.get(e.sourceId) ?? []) {
      for (const b of groupsOf.get(e.targetId) ?? []) if (a !== b) { joined[a].add(b); joined[b].add(a) }
    }
  }
  const slots: number[] = []
  groups.forEach((_, i) => {
    const held = new Set([...joined[i]].filter(j => j < i && groups[j].color === undefined).map(j => slots[j]))
    const free = Array.from({ length: size }, (_, k) => (i + k) % size).find(s => !held.has(s))
    slots.push(free ?? i % size)
  })
  return slots
}

const NO_COHESION: ReadonlyMap<string, number> = new Map()

/** `factor` for each edge whose two ends share a group; none when the factor is 1. */
export function cohesionOf(groups: readonly NodeGroup[], edges: readonly GraphEdge[], factor: number): ReadonlyMap<string, number> {
  if (factor === 1) return NO_COHESION
  const out = new Map<string, number>()
  for (const e of edges) if (groups.some(g => g.nodeIds.has(e.sourceId) && g.nodeIds.has(e.targetId))) out.set(e.id, factor)
  return out
}

/** A group as drawn. */
export interface ActiveGroup {
  /** The host's group id. */
  id: string
  /** The glow's colour: the host's, else the palette's. */
  color: string
  /** The glow's intensity: 1, or more for a group that is emphasised or holds the hovered or selected node. */
  strength: number
  /** The group's visible nodes. */
  nodeIds: ReadonlySet<string>
}

/** An active group with the `weight` its glow swells by; the canvas reads it, a host's control sees an `ActiveGroup`. */
export interface GlowGroup extends ActiveGroup {
  /** The host's `weight`. */
  weight?: number
}

/**
 * The groups as drawn: each restricted to the visible set
 * (filter-as-source-of-truth), the empty dropped, each coloured by its slot
 * in the theme's palette — so hiding one group recolours none of the others.
 */
export function activeGroupsOf(groups: readonly NodeGroup[], slots: readonly number[], visibleIds: ReadonlySet<string>, theme: Theme = 'dark', emphasized: string | null = null): GlowGroup[] {
  const palette = GROUP_PALETTE[theme]
  const out: GlowGroup[] = []
  groups.forEach((g, i) => {
    const nodeIds = new Set<string>()
    for (const id of g.nodeIds) if (visibleIds.has(id)) nodeIds.add(id)
    if (nodeIds.size === 0) return
    out.push({ id: g.id, strength: g.emphasized || g.id === emphasized ? HOVER_STRENGTH : 1, nodeIds, color: g.color ?? palette[slots[i]], weight: g.weight })
  })
  return out
}

// boostGroupsForNodes strengthens any active group that contains one of the
// focused node ids (the node hovered or selected on the canvas), so that group
// surfaces out of a field of many faint ones. Returns the same array when no
// focus node lands in any group, so the common case allocates nothing.
/** The active groups with any that holds one of the given nodes glowing at `NODE_FOCUS_STRENGTH`; the same array when none does. */
export function boostGroupsForNodes<G extends ActiveGroup>(
  groups: G[],
  focusIds: Array<string | null>,
): G[] {
  const ids = focusIds.filter((id): id is string => !!id)
  if (ids.length === 0) return groups
  let changed = false
  const boosted = groups.map(g => {
    if (ids.some(id => g.nodeIds.has(id))) {
      changed = true
      return { ...g, strength: Math.max(g.strength, NODE_FOCUS_STRENGTH) }
    }
    return g
  })
  return changed ? boosted : groups
}
