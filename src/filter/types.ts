// The filter model a host's views share: a choice per axis, over whatever
// axes the host declares, and the operations on it.
//
// Every operation here is copy-on-write: the axis being edited gets a new
// choice, every other axis keeps its exact instance, and a no-op edit
// returns the same state. The view compares choices by content, so a host
// that rebuilds a filter from a URL or a store is not read as a change —
// identity is the cheap path, not the contract.
//
// The search query lives outside a FilterState because the views share it.

import type { AxisId, AxisValues, ResolvedAxisDescriptor } from '../graph/axis'
import { valuesOn } from '../graph/axis'
import type { Graph } from '../graph/model'
import type { Taxonomy } from '../graph/taxonomy'
import { isPlainRecord } from '../json'

/**
 * The chosen values on one axis, in one of two kinds. A set is an inclusion,
 * "only these": exactly its values, so a value the data gains later stays
 * hidden; an empty one means what the axis's `emptyMeans` says. `{ except }`
 * is an exclusion, "all but these": every value the graph presents but its
 * own, so a value the data gains later shows.
 */
export type AxisChosen = ReadonlySet<string> | { except: ReadonlySet<string> }

/**
 * A choice per axis. A `Map`, not a `Record`: an axis the host did not
 * declare has no key, so a misspelt axis is a miss the type sees rather than
 * an `undefined` every downstream `.has` reads as "nothing chosen".
 */
export type FilterState = ReadonlyMap<AxisId, AxisChosen>

/**
 * Which axes are locked. A locked axis keeps its choice when a `manual`
 * switch adopts the source view's; a focus widens it anyway and reports it.
 */
export type AxisLocks = ReadonlyMap<AxisId, boolean>


/**
 * The entry for which groups are shown: an `AxisChosen` over group ids,
 * saved and controlled with the axes but not one of them — a node belongs to
 * many groups, and no taxonomy may declare an axis by this id.
 */
export const GROUPS: AxisId = '@groups'

const EMPTY: AxisChosen = new Set<string>()
const EVERY_GROUP: AxisChosen = { except: new Set<string>() }

/**
 * The choice on one axis, or, absent, an empty one — `GROUPS`'s shows
 * every group, so a filter written before a group arrived shows it.
 *
 * Always returns the *same* absent choice, so an absent axis does not change
 * identity between reads — a fresh `new Set()` per call would defeat exactly the
 * memoisation this module exists to protect.
 */
export function chosenOn(state: FilterState, axis: AxisId): AxisChosen {
  return state.get(axis) ?? (axis === GROUPS ? EVERY_GROUP : EMPTY)
}

/** Whether the group filter shows a node in `groupIds`: one in no group, or one in any group it shows. */
export function passesGroups(filter: FilterState, groupIds: readonly string[]): boolean {
  if (groupIds.length === 0) return true
  const chosen = chosenOn(filter, GROUPS)
  return groupIds.some(id => selects(chosen, id))
}

/** Every axis the state carries a choice for. */
export function axesOf(state: FilterState): AxisId[] {
  return [...state.keys()].sort()
}

/** The values a choice names: an inclusion's, or the ones an exclusion leaves out. */
export function namedBy(chosen: AxisChosen): ReadonlySet<string> {
  return 'except' in chosen ? chosen.except : chosen
}

/** Whether a choice shows `value`: an inclusion holds it, an exclusion does not. An empty inclusion is `emptyMeans`'s to read first. */
export function selects(chosen: AxisChosen, value: string): boolean {
  return 'except' in chosen ? !chosen.except.has(value) : chosen.has(value)
}

/** Whether a choice is an empty inclusion — the one `emptyMeans` reads. */
export function isEmptyChosen(chosen: AxisChosen): boolean {
  return !('except' in chosen) && chosen.size === 0
}

/** `chosen` with `values` turned on or off, of the same kind. */
export function withValues(chosen: AxisChosen, values: Iterable<string>, on: boolean): AxisChosen {
  const exclusion = 'except' in chosen
  const named = new Set(namedBy(chosen))
  for (const v of values) {
    if (on !== exclusion) named.add(v)
    else named.delete(v)
  }
  return exclusion ? { except: named } : named
}

/** Whether two sets hold the same strings. */
export function setsEqual(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

/** Whether two choices are of one kind and name the same values. */
export function chosenEqual(a: AxisChosen, b: AxisChosen): boolean {
  if (a === b) return true
  if (('except' in a) !== ('except' in b)) return false
  return setsEqual(namedBy(a), namedBy(b))
}

/**
 * Replace one axis's choice, copy-on-write.
 *
 * Returns `state` **itself** when the new choice is content-equal to the old
 * one, so a no-op edit changes no identity anywhere. Otherwise only the edited
 * axis takes `next`; every other axis is carried over by reference.
 */
export function withChosen(
  state: FilterState,
  axis: AxisId,
  next: AxisChosen,
): FilterState {
  if (chosenEqual(chosenOn(state, axis), next)) return state
  const out = new Map(state)
  out.set(axis, next)
  return out
}

/** Structural equality across every axis either state mentions. */
export function filterStatesEqual(a: FilterState, b: FilterState): boolean {
  if (a === b) return true
  const axes = new Set([...a.keys(), ...b.keys()])
  for (const axis of axes) {
    if (!chosenEqual(chosenOn(a, axis), chosenOn(b, axis))) return false
  }
  return true
}

/** Structural equality of two lock maps. */
export function locksEqual(a: AxisLocks, b: AxisLocks): boolean {
  if (a === b) return true
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

/** Element-wise equality of two lists of ids. */
export function listEqual(a: readonly string[], b: readonly string[]): boolean {
  return a === b || (a.length === b.length && a.every((v, i) => v === b[i]))
}

/** Set one axis's lock, copy-on-write. */
export function withLock(locks: AxisLocks, axis: AxisId, locked: boolean): AxisLocks {
  const out = new Map(locks)
  out.set(axis, locked)
  return out
}

/** Whether an axis is locked against adoption. */
export function lockedFor(locks: AxisLocks, axis: AxisId): boolean {
  return locks.get(axis) ?? false
}

/**
 * Where a focus transition wants to land: the target's value per axis. An
 * axis the target says nothing about is absent, which the reconciler reads
 * as "no expansion needed". A host that also needs the target's name for a
 * view of its own carries it in a type of its own.
 */
export type FocusTarget = {
  values: Readonly<Record<AxisId, string | undefined>>
  /** The groups the target belongs to, which a focus turns on when the group filter hides it. */
  groups?: readonly string[]
}

/** How a view is being switched to: by the user (`manual`: adopt the source's choices) or to show a node (`focus`: widen for its values). */
export type ViewTransition =
  | { kind: 'manual' }
  | { kind: 'focus'; target: FocusTarget }

/**
 * A reconciled filter, and which locked axes a focus had to widen to show its
 * target — the ones the destination's bar flashes.
 */
export type ReconcileResult = {
  filter: FilterState
  overriddenLocks: ReadonlySet<AxisId>
}

/**
 * The filter a view starts from: on every filter axis, what its descriptor's
 * `initialChosen` chooses from the values the graph presents there —
 * every value on an allow-list, none on a narrowing axis, or the host's own
 * choice. An allow-list's is an exclusion of the values not chosen, so a
 * value the graph gains later shows.
 */
export function initialFilter(taxonomy: Pick<Taxonomy, 'filterAxes'>, graph: Pick<Graph, 'nodes'>): FilterState {
  return new Map(taxonomy.filterAxes().map(d => [d.id, seedChosen(taxonomy, d, valuesOn(graph.nodes, d.id))]))
}

/** One axis's opening choice on the values the graph presents there: `initialFilter`'s, axis by axis. */
export function seedChosen(taxonomy: Pick<Taxonomy, 'filterAxes'>, d: ResolvedAxisDescriptor, values: readonly string[]): AxisChosen {
  const chosen = new Set(d.initialChosen(values))
  // The bar toggles a chip's values as a unit, so a choice that splits
  // one would show the chip as on with half its nodes hidden, and the
  // first click would turn the whole chip off. Snap to the whole chip —
  // choosing more is the safe direction — and say so once per chip.
  const present = new Set(values)
  for (const chip of d.chipsFor(values)) {
    const mine = chip.values.filter(v => present.has(v))
    const on = mine.filter(v => chosen.has(v))
    // Judged as the bar judges it: any value of the chip chosen — a value the
    // graph lacks included — reads as on.
    if (!chip.values.some(v => chosen.has(v)) || on.length === mine.length) continue
    for (const v of mine) chosen.add(v)
    warnSplitChip(taxonomy, d.id, chip.id, mine.filter(v => !on.includes(v)))
  }
  return d.emptyMeans === 'none' ? { except: new Set(values.filter(v => !chosen.has(v))) } : chosen
}

/**
 * A filter re-seeded for a graph that changed: every filter axis the user has
 * not touched takes its opening choice on `graph` (`initialFilter`'s), so
 * a host that mounts empty while its data loads is not left blank and a value
 * first seen later is not born hidden; an axis in `touched` keeps its
 * choice. Which axes the user touched is state, not an inference — the
 * bar names the axis of every change it makes (`onFilterChange`'s second
 * argument), the view and `useLinkedViews` keep the set, and a host that
 * controls its filter keeps its own and passes it here from its data effect.
 * Absent, every axis follows the graph. The same object when nothing moves.
 */
export function reseedFilter(filter: FilterState, taxonomy: Pick<Taxonomy, 'filterAxes'>, graph: Pick<Graph, 'nodes'>, touched: ReadonlySet<AxisId> = new Set()): FilterState {
  const seed = initialFilter(taxonomy, graph)
  let next = filter
  for (const d of taxonomy.filterAxes()) {
    if (touched.has(d.id)) continue
    next = withChosen(next, d.id, chosenOn(seed, d.id))
  }
  return next
}

/** The axes whose choice differs between two filters — what a write touched. */
export function changedAxes(a: FilterState, b: FilterState): AxisId[] {
  const out: AxisId[] = []
  for (const axis of new Set([...a.keys(), ...b.keys()])) {
    if (!chosenEqual(chosenOn(a, axis), chosenOn(b, axis))) out.push(axis)
  }
  return out
}

// Once per taxonomy and chip, not per process: a second taxonomy with the
// same split is a second mistake.
const warnedSplits = new WeakMap<object, Set<string>>()
function warnSplitChip(taxonomy: object, axis: AxisId, chip: string, added: readonly string[]): void {
  let warned = warnedSplits.get(taxonomy)
  if (!warned) { warned = new Set(); warnedSplits.set(taxonomy, warned) }
  const key = `${axis}\u0000${chip}`
  if (warned.has(key)) return
  warned.add(key)
  console.warn(`[filter] the initial choice on axis ${JSON.stringify(axis)} splits the chip ${JSON.stringify(chip)}; the whole chip is chosen (${added.map(v => JSON.stringify(v)).join(', ')} added). Choose values the chips can show.`)
}

// The records below are built from entries, not by assignment: an axis id is
// a host string, and `out['__proto__'] = …` on a literal sets the prototype
// instead of a key, so that axis would vanish from the stored text.

/** A filter as plain data — an inclusion as its values in an array, an exclusion as `{ except: [...] }` — for a URL, a store or a saved layout. */
export function filterToJSON(filter: FilterState): Record<AxisId, string[] | { except: string[] }> {
  return Object.fromEntries([...filter].map(([axis, chosen]) => [axis, 'except' in chosen ? { except: [...chosen.except] } : [...chosen]]))
}

/**
 * The filter `filterToJSON` wrote, or undefined when `value` is not that
 * shape — stored data is not trusted to be, and a host falls back to its
 * default rather than to a filter that means something else.
 */
export function filterFromJSON(value: unknown): FilterState | undefined {
  if (!isPlainRecord(value)) return undefined
  const out = new Map<AxisId, AxisChosen>()
  for (const [axis, stored] of Object.entries(value)) {
    const exclusion = isPlainRecord(stored)
    const values = exclusion ? stored.except : stored
    if (exclusion && Object.keys(stored).length !== 1) return undefined
    if (!Array.isArray(values) || !values.every((v): v is string => typeof v === 'string')) return undefined
    out.set(axis, exclusion ? { except: new Set(values) } : new Set(values))
  }
  return out
}

/** Locks as plain data — a boolean per axis — beside `filterToJSON`. */
export function locksToJSON(locks: AxisLocks): Record<AxisId, boolean> {
  return Object.fromEntries([...locks])
}

/** The locks `locksToJSON` wrote, or undefined when `value` is not that shape. */
export function locksFromJSON(value: unknown): AxisLocks | undefined {
  if (!isPlainRecord(value)) return undefined
  const out = new Map<AxisId, boolean>()
  for (const [axis, locked] of Object.entries(value)) {
    if (typeof locked !== 'boolean') return undefined
    out.set(axis, locked)
  }
  return out
}

/** Whether a node answers to a focus target: every value the target names. */
export function matchesFocus(node: { values: Readonly<Record<string, string>> }, target: FocusTarget): boolean {
  for (const [axis, value] of Object.entries(target.values)) {
    if (value !== undefined && node.values[axis] !== value) return false
  }
  return true
}

/** What `passesChosen` reads. */
export interface PassesChosenInput<N> {
  /** The choices the record is judged against. */
  filter: FilterState
  /** Resolves each axis's policy. */
  taxonomy: Pick<Taxonomy, 'axisFor'>
  /** The axes the view shows — the only ones that filter. One the taxonomy does not declare filters nothing. */
  axes: readonly AxisId[]
  /** The record judged: a graph node, or any record of the host's. */
  node: N
  /** The record's value on an axis, for a record that carries its values under other names. Default: its `values`, when it has them. */
  valueOn?: (node: N, axis: AxisId) => string | undefined
}

/** Whether a record carries `values` the way a graph node does. */
function carriesValues(record: unknown): record is { values?: AxisValues } {
  return typeof record === 'object' && record !== null
}

/**
 * Does a record pass the choice on the axes a view shows? The policy —
 * what an empty choice means, what an absent value means — is read from
 * each axis's descriptor, once, here, so a host's second view and the pane
 * agree on what the filter means.
 */
export function passesChosen<N>({ filter, taxonomy, axes, node, valueOn }: PassesChosenInput<N>): boolean {
  const read = valueOn ?? ((n: N, axis: AxisId) => (carriesValues(n) ? n.values?.[axis] : undefined))
  for (const id of axes) {
    const d = taxonomy.axisFor(id)
    if (d && !passesDescriptors(filter, [d], axis => read(node, axis))) return false
  }
  return true
}

/** `passesChosen` over descriptors already resolved — the view's hot path, which resolves them once per render. */
export function passesDescriptors(
  filter: FilterState,
  axes: readonly ResolvedAxisDescriptor[],
  valueOn: (axis: string) => string | undefined,
): boolean {
  for (const axis of axes) {
    const chosen = chosenOn(filter, axis.id)
    if (isEmptyChosen(chosen)) {
      if (axis.emptyMeans === 'none') return false
      continue
    }
    const value = valueOn(axis.id)
    if (value === undefined) {
      if (axis.absentMeans === 'hidden') return false
      continue
    }
    if (!selects(chosen, value)) return false
  }
  return true
}

/** Search matches split by the filter: the visible ones, and the hidden ones tallied on the chip hiding each. */
export interface HiddenMatches {
  /** The ids of the matching nodes the filter shows. */
  visible: ReadonlySet<string>
  /** How many matching nodes the filter hides. */
  hiddenCount: number
  /** The hidden matches per axis and value — on the first of the axes shown that each node fails, under its value there. */
  hiddenByAxis: ReadonlyMap<AxisId, ReadonlyMap<string, number>>
}

/** What `hiddenMatchesOf` reads. */
export interface HiddenMatchesInput<N extends { id: string; values?: AxisValues }> {
  /** Every node the search ran over, visible or not. */
  nodes: Iterable<N>
  /** The choices that hide nodes. */
  filter: FilterState
  /** Resolves each axis's policy. */
  taxonomy: Pick<Taxonomy, 'axisFor'>
  /** The axes the view shows, in order: the first one a hidden match fails is the chip it is counted on. */
  axes: readonly AxisId[]
  /** The ids of the nodes the filter shows. */
  visibleIds: ReadonlySet<string>
  /** Whether a node matches the search. */
  matches: (node: N) => boolean
  /** A node's value on an axis. Default: its `values`. */
  valueOn?: (node: N, axis: AxisId) => string | undefined
}

/**
 * Split a search's matches by the filter, the way the pane does under its
 * own bar: a match the filter shows lights up, a match it hides is counted
 * on the chip hiding it — the first axis in `axes` the node fails, under the
 * node's value there — so a host's second bar can wear the same badges.
 */
export function hiddenMatchesOf<N extends { id: string; values?: AxisValues }>({ nodes, filter, taxonomy, axes, visibleIds, matches, valueOn }: HiddenMatchesInput<N>): HiddenMatches {
  const read = valueOn ?? ((node: N, axis: AxisId) => node.values?.[axis])
  const descriptors = axes.flatMap(id => { const d = taxonomy.axisFor(id); return d ? [d] : [] })
  const visible = new Set<string>()
  let hiddenCount = 0
  const hiddenByAxis = new Map<AxisId, Map<string, number>>()
  for (const node of nodes) {
    if (!matches(node)) continue
    if (visibleIds.has(node.id)) { visible.add(node.id); continue }
    hiddenCount++
    const failing = descriptors.find(d => !passesDescriptors(filter, [d], axis => read(node, axis)))
    const value = failing ? read(node, failing.id) : undefined
    if (!failing || value === undefined) continue
    const tally = hiddenByAxis.get(failing.id) ?? new Map<string, number>()
    tally.set(value, (tally.get(value) ?? 0) + 1)
    hiddenByAxis.set(failing.id, tally)
  }
  return { visible, hiddenCount, hiddenByAxis }
}
