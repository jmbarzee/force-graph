import { expect, it } from 'vitest'
import { nodesById } from '../../graph/model'
import type { GraphNode } from '../../graph/model'
import { ancestry, tabOrder } from './tabOrder'

const node = (id: string, name: string, parentId?: string): GraphNode => ({ id, name, parentId, values: {} })
const all = [node('r', 'Root'), node('b', 'Beta', 'r'), node('a', 'Alpha', 'r'), node('a1', 'Apple', 'a'), node('z', 'Zed')]
const byId = nodesById(all)
const nodeOf = (id: string) => byId.get(id)

it('walks the containment tree depth-first, siblings by name', () => {
  expect(tabOrder(all, nodeOf)).toEqual(['r', 'a', 'a1', 'b', 'z'])
})

it('puts a node whose container is not drawn under its nearest drawn ancestor', () => {
  expect(tabOrder(all.filter(n => n.id !== 'a'), nodeOf)).toEqual(['r', 'a1', 'b', 'z'])
})

it('reads a node and its containers, nearest first, past a cycle', () => {
  expect(ancestry('a1', nodeOf)).toEqual(['a1', 'a', 'r'])
  const cycle = nodesById([node('x', 'X', 'y'), node('y', 'Y', 'x')])
  expect(ancestry('x', id => cycle.get(id))).toEqual(['x', 'y'])
})
