import { describe, expect, it } from 'vitest'
import { getTransitiveDeps } from './highlight'
import type { GraphEdge } from './model'

// a → b, and b — c undirected.
const edges: GraphEdge[] = [
  { id: 'ab', sourceId: 'a', targetId: 'b' },
  { id: 'bc', sourceId: 'b', targetId: 'c' },
]
const visible = new Set(['a', 'b', 'c'])
const undirected = new Set(['bc'])

describe('getTransitiveDeps', () => {
  it('walks a directed edge one way and an undirected edge both ways', () => {
    expect(getTransitiveDeps('a', edges, visible, 'downstream', undirected)).toEqual(new Set(['a', 'b', 'c']))
    expect(getTransitiveDeps('b', edges, visible, 'upstream', undirected)).toEqual(new Set(['b', 'a', 'c']))
    expect(getTransitiveDeps('c', edges, visible, 'upstream', undirected)).toEqual(new Set(['c', 'b', 'a']))
    expect(getTransitiveDeps('c', edges, visible, 'downstream', undirected)).toEqual(new Set(['c', 'b']))
  })
})
