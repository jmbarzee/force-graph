import { describe, expect, it } from 'vitest'
import { fillOf } from './coloring'
import { hueOf, keyVars, pairOf, PALETTE } from './scheme'
import { createTaxonomy } from './taxonomy'
import { scopeStyle } from '../styles/tokens'

describe('hueOf', () => {
  it('serves a string in both themes, a hue as given, and absent its palette slot', () => {
    expect(hueOf('#123456', 0)).toEqual({ light: '#123456', dark: '#123456' })
    expect(hueOf({ light: '#000000', dark: '#ffffff' }, 0)).toEqual({ light: '#000000', dark: '#ffffff' })
    expect(hueOf(undefined, 12)).toBe(PALETTE[2])
  })
})

describe('keyVars', () => {
  const taxonomy = createTaxonomy({
    styleAxis: 'kind',
    values: [{ id: 'red', label: 'Red', color: { light: { fill: '#111111', border: '#000000' }, dark: { fill: '#eeeeee', border: '#ffffff' } } }],
    filterAxes: [{ id: 'team', emptyMeans: 'all' }],
  })
  const graph = { nodes: [{ id: 'a', name: 'a', values: { kind: 'red', team: 'red' } }, { id: 'b', name: 'b', values: { kind: 'red', team: 'blueTeam' } }], edges: [] }
  const fill = fillOf({ by: 'axis', axis: 'team' }, graph, taxonomy)

  it('publishes each key’s fill and border under its name, in either theme', () => {
    expect(keyVars(fill, 'dark')).toEqual({
      '--gv-node-red': PALETTE[0].dark, '--gv-node-red-border': pairOf(PALETTE[0]).dark.border,
      '--gv-node-blue-team': PALETTE[1].dark, '--gv-node-blue-team-border': pairOf(PALETTE[1]).dark.border,
    })
    expect(keyVars(fill, 'light')).toMatchObject({ '--gv-node-red': PALETTE[0].light })
  })

  it('numbers keys that kebab-case alike, and one that kebab-cases to nothing', () => {
    const langs = { nodes: ['C', 'C++', 'C#', 'Ψ'].map(lang => ({ id: lang, name: lang, values: { kind: 'red', team: lang } })), edges: [] }
    const named = fillOf({ by: 'axis', axis: 'team' }, langs, taxonomy)
    expect([...named.keys.values()].map(k => k.cssVar)).toEqual(['--gv-node-c', '--gv-node-c-2', '--gv-node-c-3', '--gv-node-k4'])
    expect(keyVars(named, 'light')).toMatchObject({ '--gv-node-c': PALETTE[0].light, '--gv-node-c-2': PALETTE[1].light, '--gv-node-c-3': PALETTE[2].light, '--gv-node-k4': PALETTE[3].light })
  })

  it('wins over a style value of the same name in a scope', () => {
    expect(scopeStyle(taxonomy, 'light', undefined, fill)).toMatchObject({ '--gv-node-red': PALETTE[0].light })
    expect(scopeStyle(taxonomy, 'light')).toMatchObject({ '--gv-node-red': '#111111' })
  })
})

describe('pairOf', () => {
  it('fills with the hue and borders it darker in both themes', () => {
    expect(pairOf({ light: '#ff8000', dark: 'rgb(100, 200, 50)' })).toEqual({
      light: { fill: '#ff8000', border: '#994d00' },
      dark: { fill: 'rgb(100, 200, 50)', border: '#3c781e' },
    })
  })
})
