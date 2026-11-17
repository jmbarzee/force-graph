// Group overlay — the glow groups the Graph view draws. A host hands the view
// groups over the WHOLE graph: either derived, keys it declares and a function
// answering each node's keys, or listed, an id and the node ids each covers.
// The view settles membership and palette slots once per graph and groups,
// then restricts each group to the visible set on every render and drops the
// empty — so a group keeps its colour when a filter hides others. What a
// group IS — the host's chunking, what the user has drilled into — is the
// host's.

import type { GraphEdge, GraphNode } from './model'
import type { Theme, ThemedHue } from './scheme'
import { hueOf, isSchemeColor, PALETTE } from './scheme'
import type { GraphDiagnostic } from './validate'

// Glow intensity multiplier for the group its control emphasises (hovered in
// its legend, vs. the default 1). Drives both brightness and — since the
// canvas swells focused groups — halo/corridor size.
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
  /** The glow's colour, one for both themes or a hue per theme: hex, `rgb()` or `hsl()`; absent or any other, a palette slot no group joined to it by an edge holds. */
  color?: string | ThemedHue
  /** 0..1: how far the glow's halo and corridor swell; absent, they do not. */
  weight?: number
}

/** One key of a set-shaped channel, in the order its palette slots follow. */
export interface LegendKey {
  /** What `of` answers for a node in this key's group. */
  id: string
  /** The key's name in a legend. */
  label: string
  /** The key's colour, one for both themes or a hue per theme: hex, `rgb()` or `hsl()`; absent or any other, a palette slot no key joined to it by an edge holds. */
  color?: string | ThemedHue
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

/** A key or group as given, or without a `color` outside the scheme's forms, which adds a `key-color-invalid` warning. */
export function checkedKey<K extends { id: string; color?: string | ThemedHue }>(key: K, diagnostics: GraphDiagnostic[]): K {
  if (key.color === undefined || isSchemeColor(key.color)) return key
  diagnostics.push({ severity: 'warning', code: 'key-color-invalid', message: `key ${JSON.stringify(key.id)} has colour ${JSON.stringify(key.color)}, which is not hex, rgb() or hsl(); the view gives it a palette colour` })
  return { ...key, color: undefined }
}

/**
 * The listed form of `groups` over `nodes`, each colour through `checkedKey`,
 * with a `key-undeclared` warning per key `of` answers that `keys` does not
 * declare. A listed form with no invalid colour comes back as given; no
 * warnings come back as one shared empty list.
 */
export function nodeGroupsOf(groups: Groups, nodes: readonly GraphNode[]): { groups: readonly NodeGroup[]; diagnostics: readonly GraphDiagnostic[] } {
  const diagnostics: GraphDiagnostic[] = []
  if (!('of' in groups)) {
    const listed = groups.map(g => checkedKey(g, diagnostics))
    return diagnostics.length ? { groups: listed, diagnostics } : { groups, diagnostics: NO_DIAGNOSTICS }
  }
  const listed = groups.keys.map(k => ({ id: k.id, nodeIds: new Set<string>(), color: checkedKey(k, diagnostics).color, weight: k.weight }))
  const members = new Map(listed.map(g => [g.id, g.nodeIds]))
  const undeclared = new Set<string>()
  for (const node of nodes) {
    for (const key of groups.of(node)) {
      const ids = members.get(key)
      if (ids) ids.add(node.id)
      else if (!undeclared.has(key)) {
        undeclared.add(key)
        diagnostics.push({ severity: 'warning', code: 'key-undeclared', nodeId: node.id, message: `node ${JSON.stringify(node.id)} belongs to group ${JSON.stringify(key)}, which the groups' keys do not declare; the view ignores it` })
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
  const size = PALETTE.length
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

/** Each node's group ids, in the groups' order; a node in none is absent. */
export function groupsByNode(groups: readonly NodeGroup[]): ReadonlyMap<string, readonly string[]> {
  const out = new Map<string, string[]>()
  for (const g of groups) {
    for (const id of g.nodeIds) {
      const of = out.get(id)
      if (of) of.push(g.id)
      else out.set(id, [g.id])
    }
  }
  return out
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
 * The groups as drawn: the ones `shown`, each restricted to the visible set
 * (filter-as-source-of-truth), the empty dropped, each coloured by its slot
 * in the theme's palette — so hiding one group recolours none of the others.
 */
export function activeGroupsOf(groups: readonly NodeGroup[], slots: readonly number[], visibleIds: ReadonlySet<string>, shown: (id: string) => boolean = () => true, theme: Theme = 'dark', emphasized: string | null = null): GlowGroup[] {
  const out: GlowGroup[] = []
  groups.forEach((g, i) => {
    if (!shown(g.id)) return
    const nodeIds = new Set<string>()
    for (const id of g.nodeIds) if (visibleIds.has(id)) nodeIds.add(id)
    if (nodeIds.size === 0) return
    out.push({ id: g.id, strength: g.id === emphasized ? HOVER_STRENGTH : 1, nodeIds, color: hueOf(g.color, slots[i])[theme], weight: g.weight })
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
