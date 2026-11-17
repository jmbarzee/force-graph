import { describe, expect, it } from 'vitest'
import { activeGroupsOf, GROUP_PALETTE, nodeGroupsOf } from './groups'
import type { DerivedGroups, NodeGroup } from './groups'
import type { GraphNode } from './model'

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

  it('reports a key no key declares once, however many nodes answer it', () => {
    const { diagnostics } = nodeGroupsOf(derived, nodes)
    expect(diagnostics).toHaveLength(1)
    expect(diagnostics[0]).toMatchObject({ severity: 'warning', code: 'group-key-undeclared', nodeId: 'c' })
  })

  it('hands a listed form back as given', () => {
    const listed: NodeGroup[] = [{ id: 'x', nodeIds: new Set(['a']) }]
    expect(nodeGroupsOf(listed, nodes)).toEqual({ groups: listed, diagnostics: [] })
  })
})

describe('activeGroupsOf over derived groups', () => {
  it('recolours no key when a filter hides every member of another', () => {
    const { groups } = nodeGroupsOf(derived, nodes)
    const colours = (visible: string[]) => new Map(activeGroupsOf(groups, new Set(visible)).map(g => [g.id, g.color]))
    const all = colours(['a', 'b', 'c', 'd'])
    const redHidden = colours(['c', 'd'])
    expect(redHidden.has('red')).toBe(false)
    expect(redHidden.get('green')).toBe(all.get('green'))
    expect(all.get('green')).toBe(GROUP_PALETTE.dark[2])
  })
})
