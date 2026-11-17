import { describe, expect, it } from 'vitest'
import { activeGroupsOf, boostGroupsForNodes, cohesionOf, groupsByNode, groupSlotsOf, NODE_FOCUS_STRENGTH, nodeGroupsOf } from './groups'
import type { DerivedGroups, GlowSource, NodeGroup } from './groups'
import type { GraphEdge, GraphNode } from './model'

const node = (id: string, sets: string[]): GraphNode => ({ id, name: id, values: {}, payload: { sets } })
const nodes = [node('a', ['red']), node('b', ['red', 'blue']), node('c', ['green', 'mauve']), node('d', ['mauve'])]
const derived: DerivedGroups = {
  keys: [{ id: 'red', label: 'Red' }, { id: 'blue', label: 'Blue', color: '#123456' }, { id: 'green', label: 'Green' }],
  of: n => n.payload?.sets as string[],
}

describe('nodeGroupsOf', () => {
  it('gives each declared key, in order, the nodes that answer it', () => {
    const { groups } = nodeGroupsOf(derived, nodes)
    expect(groups.map(g => [g.id, [...g.nodeIds], g.color])).toEqual([
      ['red', ['a', 'b'], undefined],
      ['blue', ['b'], '#123456'],
      ['green', ['c'], undefined],
    ])
  })

  it('reports an undeclared key once', () => {
    const { diagnostics } = nodeGroupsOf(derived, nodes)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ severity: 'warning', code: 'key-undeclared', nodeId: 'c' })
  })

  it('answers no warnings with one shared empty list', () => {
    const declared: DerivedGroups = { keys: derived.keys, of: () => ['red'] }
    expect(nodeGroupsOf(declared, nodes).diagnostics).toBe(nodeGroupsOf([], nodes).diagnostics)
  })

  it('hands a listed form back as given', () => {
    const listed: NodeGroup[] = [{ id: 'x', nodeIds: new Set(['a']), color: ' HSL(120, 50%, 40%) ' }]
    expect(nodeGroupsOf(listed, nodes)).toEqual({ groups: listed, diagnostics: [] })
  })

  it('drops a colour that is not hex, rgb() or hsl(), with one warning', () => {
    for (const color of ['nope', '#11223344', 'var(--x)']) {
      const { groups, diagnostics } = nodeGroupsOf([group('x', 'a')].map(g => ({ ...g, color })), nodes)
      expect(diagnostics.map(d => d.code)).toEqual(['key-color-invalid'])
      expect(groups[0]!.color).toBeUndefined()
    }
    expect(nodeGroupsOf({ ...derived, keys: [{ id: 'red', label: 'Red', color: 'nope' }] }, nodes).diagnostics.map(d => d.code)).toContain('key-color-invalid')
  })
})

describe('groupsByNode', () => {
  it("lists each node's groups in the groups' order, and no node in none", () => {
    expect([...groupsByNode([group('x', 'a', 'b'), group('y', 'b')])]).toEqual([['a', ['x']], ['b', ['x', 'y']]])
  })
})

describe('activeGroupsOf', () => {
  const hue = { light: '#010101', dark: '#fefefe' }
  const source = (id: string, ...ids: string[]): GlowSource => ({ id, nodeIds: new Set(ids), color: hue })
  const sources = [source('red', 'a', 'b'), source('blue', 'b'), source('green', 'c')]

  it('restricts each source to the visible set and drops the empty', () => {
    expect(activeGroupsOf(sources, new Set(['b', 'c'])).map(g => [g.id, [...g.nodeIds]])).toEqual([['red', ['b']], ['blue', ['b']], ['green', ['c']]])
    expect(activeGroupsOf(sources, new Set(['c'])).map(g => g.id)).toEqual(['green'])
  })

  it('draws each source in its colour for the theme', () => {
    for (const theme of ['light', 'dark'] as const) expect(activeGroupsOf(sources, new Set(['a']), undefined, theme)[0]!.color).toBe(hue[theme])
  })

  it('draws no glow for a source not shown', () => {
    expect(activeGroupsOf(sources, new Set(['a', 'b', 'c']), id => id !== 'red').map(g => g.id)).toEqual(['blue', 'green'])
  })

  it('glows the emphasised source stronger, and boosts any holding a focused node', () => {
    const drawn = activeGroupsOf(sources, new Set(['a', 'b', 'c']), undefined, 'dark', 'green')
    expect(drawn.map(g => g.strength)).toEqual([1, 1, expect.any(Number)])
    expect(drawn[2]!.strength).toBeGreaterThan(1)
    expect(boostGroupsForNodes(drawn, ['a', null]).map(g => g.strength)).toEqual([NODE_FOCUS_STRENGTH, 1, drawn[2]!.strength])
    expect(boostGroupsForNodes(drawn, [null])).toBe(drawn)
  })
})

const edge = (sourceId: string, targetId: string): GraphEdge => ({ id: `${sourceId}-${targetId}`, sourceId, targetId })
const group = (id: string, ...ids: string[]): NodeGroup => ({ id, nodeIds: new Set(ids) })

describe('groupSlotsOf', () => {
  it('gives each group its place when no edge joins two', () => {
    expect(groupSlotsOf([group('x', 'a'), group('y', 'b'), group('z', 'c')], [])).toEqual([0, 1, 2])
  })

  it('moves a group off a slot a group joined to it by an edge holds', () => {
    const groups = Array.from({ length: 11 }, (_, i) => group(`g${i}`, `n${i}`))
    // g10 wraps onto g0's slot; an edge between them moves it to the next free one.
    expect(groupSlotsOf(groups, [])[10]).toBe(0)
    expect(groupSlotsOf(groups, [edge('n0', 'n10')])[10]).toBe(1)
  })

  it('ignores a coloured group, which holds no slot', () => {
    const groups = Array.from({ length: 11 }, (_, i) => group(`g${i}`, `n${i}`))
    groups[0] = { ...groups[0], color: '#123456' }
    expect(groupSlotsOf(groups, [edge('n0', 'n10')])[10]).toBe(0)
  })
})

describe('cohesionOf', () => {
  const groups = [group('x', 'a', 'b'), group('y', 'c')]
  const edges = [edge('a', 'b'), edge('b', 'c')]

  it('stiffens only an edge whose ends share a group', () => {
    expect([...cohesionOf(groups, edges, 3)]).toEqual([['a-b', 3]])
  })

  it('answers the default with one shared empty map', () => {
    expect(cohesionOf(groups, edges, 1)).toBe(cohesionOf([], [], 1))
    expect(cohesionOf(groups, edges, 1).size).toBe(0)
  })
})
