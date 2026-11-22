import { describe, expect, it } from 'vitest'
import { graphEquals, type Graph } from './model'

describe('graphEquals', () => {
  it('tells apart two graphs that differ only in a node\'s stack', () => {
    const graph = (stack?: boolean): Graph => ({ nodes: [{ id: 'a', name: 'a', values: {}, stack }], edges: [] })
    expect(graphEquals(graph(), graph())).toBe(true)
    expect(graphEquals(graph(), graph(true))).toBe(false)
  })
})
