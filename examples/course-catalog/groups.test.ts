import { describe, expect, it } from 'vitest'
import { activeGroupsOf, groupSlotsOf, nodeGroupsOf } from '../../src/graph/groups'
import { catalog } from './data'
import { buildGraph, programmeGroups } from './graph'

const graph = buildGraph(catalog)
const { groups, diagnostics } = nodeGroupsOf(programmeGroups(catalog), graph.nodes)
const slots = groupSlotsOf(groups, graph.edges)
const colours = (visible: ReadonlySet<string>) => new Map(activeGroupsOf(groups, slots, visible).map(g => [g.id, g.color]))

describe('programme groups', () => {
  it('derive every programme from the payload, each with members', () => {
    expect(diagnostics).toEqual([])
    expect(groups.map(g => g.id)).toEqual(catalog.programmes.map(p => p.id))
    for (const g of groups) expect(g.nodeIds.size).toBeGreaterThan(0)
  })

  it('keep their colours when a filter hides every node of one of them', () => {
    const all = colours(new Set(graph.nodes.map(n => n.id)))
    for (const hidden of groups) {
      const rest = colours(new Set(graph.nodes.map(n => n.id).filter(id => !hidden.nodeIds.has(id))))
      expect(rest.has(hidden.id)).toBe(false)
      for (const [id, colour] of rest) expect(colour).toBe(all.get(id))
    }
  })

  it('glow in different hues when an edge joins two', () => {
    const all = colours(new Set(graph.nodes.map(n => n.id)))
    for (const e of graph.edges) {
      for (const a of groups) {
        for (const b of groups) {
          if (a !== b && a.nodeIds.has(e.sourceId) && b.nodeIds.has(e.targetId)) expect(all.get(a.id)).not.toBe(all.get(b.id))
        }
      }
    }
  })
})
