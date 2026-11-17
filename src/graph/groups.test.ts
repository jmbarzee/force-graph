import { describe, expect, it } from 'vitest'
import { activeGroupsOf, cohesionOf, GROUP_PALETTE, groupSlotsOf, nodeGroupsOf } from './groups'
import type { DerivedGroups, NodeGroup } from './groups'
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
    expect(diagnostics[0]).toMatchObject({ severity: 'warning', code: 'group-key-undeclared', nodeId: 'c' })
  })

  it('answers no warnings with one shared empty list', () => {
    const declared: DerivedGroups = { keys: derived.keys, of: () => ['red'] }
    expect(nodeGroupsOf(declared, nodes).diagnostics).toBe(nodeGroupsOf([], nodes).diagnostics)
  })

  it('hands a listed form back as given', () => {
    const listed: NodeGroup[] = [{ id: 'x', nodeIds: new Set(['a']) }]
    expect(nodeGroupsOf(listed, nodes)).toEqual({ groups: listed, diagnostics: [] })
  })
})

describe('activeGroupsOf over derived groups', () => {
  it('recolours no key when a filter hides every member of another', () => {
    const { groups } = nodeGroupsOf(derived, nodes)
    const colours = (visible: string[]) => new Map(activeGroupsOf(groups, groupSlotsOf(groups, []), new Set(visible)).map(g => [g.id, g.color]))
    const all = colours(['a', 'b', 'c', 'd'])
    const redHidden = colours(['c', 'd'])
    expect(redHidden.has('red')).toBe(false)
    expect(redHidden.get('green')).toBe(all.get('green'))
    expect(all.get('green')).toBe(GROUP_PALETTE.dark[2])
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
