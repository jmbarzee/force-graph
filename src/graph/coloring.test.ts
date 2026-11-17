import { describe, expect, it, vi } from 'vitest'
import { fillOf, pairFor, resolveColoring } from './coloring'
import type { Coloring, SetColoring } from './coloring'
import type { GraphNode } from './model'
import { PALETTE, pairOf } from './scheme'
import type { NodeStyle } from './shapes'
import { createTaxonomy } from './taxonomy'

const style = (id: string, label: string, light: string, dark: string): NodeStyle => ({
  id, label, color: { light: { fill: light, border: light }, dark: { fill: dark, border: dark } },
})
const taxonomy = createTaxonomy({
  styleAxis: 'kind',
  styles: [style('service', 'Service', '#111111', '#eeeeee'), style('queue', 'Queue', '#222222', '#dddddd'), style('store', 'Store', '#333333', '#cccccc')],
  filterAxes: [
    { id: 'kind', emptyMeans: 'all' },
    { id: 'team', emptyMeans: 'all', labelFor: v => v.toUpperCase(), chipsFor: values => [...values].sort().map(v => ({ id: v, label: v, values: [v] })) },
  ],
})
const node = (id: string, values: Record<string, string>, sets: string[] = []): GraphNode => ({ id, name: id, values, payload: { sets } })
const nodes = [node('a', { kind: 'queue', team: 'red' }, ['x']), node('b', { kind: 'service', team: 'blue' }, ['x', 'y']), node('c', { kind: 'service', team: 'green' }), node('d', {})]
const resolve = (coloring: SetColoring, of = nodes) => resolveColoring(coloring, { nodes: of, edges: [] }, taxonomy, [])

describe('resolveColoring by axis', () => {
  it('defaults the keys to the graph’s values in chip order, labelled by labelFor, each in its slot', () => {
    const { keys, of } = resolve({ by: 'axis', axis: 'team' })
    expect([...keys]).toEqual([
      ['blue', { label: 'BLUE', hue: PALETTE[0] }],
      ['green', { label: 'GREEN', hue: PALETTE[1] }],
      ['red', { label: 'RED', hue: PALETTE[2] }],
    ])
    expect(nodes.map(n => of.get(n.id))).toEqual([['red'], ['blue'], ['green'], []])
  })

  it('defaults the style axis to its declared order and fills', () => {
    expect([...resolve({ by: 'axis', axis: 'kind' }).keys]).toEqual([
      ['service', { label: 'Service', hue: { light: '#111111', dark: '#eeeeee' } }],
      ['queue', { label: 'Queue', hue: { light: '#222222', dark: '#dddddd' } }],
    ])
  })

  it('takes declared keys over the defaults, and a value outside them resolves to none silently', () => {
    const { keys, of, diagnostics } = resolve({ by: 'axis', axis: 'team', keys: [{ id: 'red', label: 'Red' }] })
    expect([...keys.keys()]).toEqual(['red'])
    expect(of.get('b')).toEqual([])
    expect(diagnostics).toEqual([])
  })
})

describe('resolveColoring by node', () => {
  const keys = [{ id: 'red', label: 'Red' }, { id: 'blue', label: 'Blue', color: '#123456' }, { id: 'green', label: 'Green', color: { light: '#010101', dark: '#fefefe' } }]
  const coloring = (of: (node: GraphNode) => string | undefined): Coloring => ({ by: 'node', keys, of })

  it('serves a string key in both themes and a hue key per theme', () => {
    const resolved = resolve(coloring(n => n.values.team))
    expect(resolved.keys.get('blue')!.hue).toEqual({ light: '#123456', dark: '#123456' })
    expect(resolved.keys.get('green')!.hue).toEqual({ light: '#010101', dark: '#fefefe' })
  })

  it('keeps every slot when nodes are removed', () => {
    const all = resolve(coloring(n => n.values.team)).keys
    expect(resolve(coloring(n => n.values.team), nodes.slice(2)).keys).toEqual(all)
  })

  it('asks for each node’s key once, and shares one array per key and one empty array among the keyless', () => {
    const of = vi.fn((n: GraphNode) => (n.id === 'd' ? undefined : 'red'))
    const resolved = resolve(coloring(of))
    expect(of).toHaveBeenCalledTimes(nodes.length)
    expect(resolved.of.get('a')).toBe(resolved.of.get('b'))
    expect(resolved.of.get('d')).toEqual([])
    expect(resolve({ by: 'groups' }).of.get('d')).toBe(resolved.of.get('d'))
  })

  it('resolves an undeclared key to none and reports it once', () => {
    const { of, diagnostics } = resolve(coloring(() => 'mauve'))
    expect(of.get('a')).toEqual([])
    expect(diagnostics).toEqual([expect.objectContaining({ severity: 'warning', code: 'key-undeclared', nodeId: 'a' })])
  })

  it('gives a colour it cannot read its slot, warned once', () => {
    const { keys: resolved, diagnostics } = resolve({ by: 'node', keys: [keys[0], { id: 'bad', label: 'Bad', color: { light: '#fff', dark: 'nope' } }], of: () => 'bad' })
    expect(resolved.get('bad')!.hue).toBe(PALETTE[1])
    expect(diagnostics.map(d => d.code)).toEqual(['key-color-invalid'])
  })
})

describe('resolveColoring by groups', () => {
  it('reads derived groups with their labels and listed groups by id, many keys per node', () => {
    const derived = resolveColoring({ by: 'groups' }, { nodes, edges: [] }, taxonomy, {
      keys: [{ id: 'x', label: 'Ex' }, { id: 'y', label: 'Why' }],
      of: n => n.payload?.sets as string[],
    })
    expect([...derived.keys]).toEqual([['x', { label: 'Ex', hue: PALETTE[0] }], ['y', { label: 'Why', hue: PALETTE[1] }]])
    expect(derived.of.get('b')).toEqual(['x', 'y'])
    const listed = resolveColoring({ by: 'groups' }, { nodes, edges: [] }, taxonomy, [{ id: 'x', nodeIds: new Set(['a']) }])
    expect(listed.keys.get('x')!.label).toBe('x')
  })
})

describe('fillOf', () => {
  it('follows the style axis when absent, in the styles’ own colours, a node of no declared style keyless', () => {
    const fill = fillOf(undefined, { nodes, edges: [] }, taxonomy)
    expect(fill.axis).toBe('kind')
    expect([...fill.keys.keys()]).toEqual(['service', 'queue', 'store'])
    expect(fill.keys.get('queue')).toEqual({ label: 'Queue', color: taxonomy.styleOf('queue').color, cssVar: taxonomy.colorVar('queue') })
    expect(nodes.map(n => fill.of.get(n.id))).toEqual(['queue', 'service', 'service', undefined])
    expect(fillOf({ by: 'axis', axis: 'kind' }, { nodes, edges: [] }, taxonomy)).toEqual(fill)
  })

  it('pairs each key’s hue as fill and border on another axis', () => {
    const fill = fillOf({ by: 'axis', axis: 'team' }, { nodes, edges: [] }, taxonomy)
    expect(fill.axis).toBe('team')
    expect(fill.keys.get('blue')).toEqual({ label: 'BLUE', color: pairOf(PALETTE[0]), cssVar: '--gv-node-blue' })
    expect(fill.of.get('a')).toBe('red')
    expect(fill.of.has('d')).toBe(false)
  })
})

describe('pairFor', () => {
  it('answers a keyed node its key’s colour and a keyless one the fallback', () => {
    const fill = fillOf({ by: 'axis', axis: 'team' }, { nodes, edges: [] }, taxonomy)
    const fallback = taxonomy.styleOf(undefined).color
    expect(pairFor(fill, 'a', fallback)).toBe(fill.keys.get('red')!.color)
    expect(pairFor(fill, 'd', fallback)).toBe(fallback)
  })
})
