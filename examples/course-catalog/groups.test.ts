import { describe, expect, it } from 'vitest'
import { activeGroupsOf, nodeGroupsOf } from '../../src/graph/groups'
import { catalog } from './data'
import { buildGraph, programmeGroups } from './graph'

const graph = buildGraph(catalog)
const { groups, diagnostics } = nodeGroupsOf(programmeGroups(catalog, new Set(catalog.programmes.map(p => p.id))), graph.nodes)
const colours = (visible: ReadonlySet<string>) => new Map(activeGroupsOf(groups, visible).map(g => [g.id, g.color]))

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
})
