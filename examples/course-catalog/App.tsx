// The host shell, leaning on the view's defaults. It controls the state its own
// panel writes (the filter) or follows (the selection, which closing the panel
// clears), hands the theme choice in from the URL, asks the view to reveal a
// node by naming it (`focus`), keeps where the nodes came to rest across a
// reload, and leaves the axes, the locks and the search to the view. It
// supplies what only the host can know — findings, programme groups, a preset
// of its own, and what "Open details" does — glows by programme or campus, and
// rings by term.

import React from 'react'
import {
  ColorLegend, GraphView, TUNING_PRESETS, TaxonomyContext, copyGroups, copyKeyOf, initialFilter, nodesById, payloadNumber, payloadString, useFocusRequest, useScheme, withChosen,
} from '@jmbarzee/force-graph'
import type {
  Coloring, FilterState, GraphNode, SetColoring, ThemeChoice, TuningPreset,
} from '@jmbarzee/force-graph'
import { CAMPUS_LABEL, catalog } from './data'
import type { Campus, Catalog, Term } from './data'
import { buildGraph, programmeGroups } from './graph'
import { loadPositions, savePositions } from './positions'
import { CAMPUS, ENTITY, taxonomy } from './taxonomy'
import type { Entity } from './taxonomy'
import './app.css'

const graph = buildGraph(catalog)
const nodeById = nodesById(graph.nodes)
const nodeByCode = new Map(graph.nodes.map(n => [payloadString(n, 'code') ?? n.id, n]))
const copies = copyGroups(graph)
const groups = programmeGroups(catalog)
const labels = { [CAMPUS]: CAMPUS_LABEL }
/** What the glow can follow: the programmes, or the campus axis while the programmes stay declared. */
const GLOW = { programmes: { by: 'groups' }, campus: { by: 'axis', axis: CAMPUS } } satisfies Record<string, SetColoring>
type GlowBy = keyof typeof GLOW
const TERMS: readonly Term[] = ['Autumn', 'Spring', 'Summer']
/** Each course and lab ringed by its term. */
const RING: Coloring = { by: 'node', keys: TERMS.map(t => ({ id: t, label: t })), of: n => payloadString(n, 'term') }
/** Opens selected: ringed by term, dashed (no department owns IDST) and a copy of PHIL 300. */
const OPENING = [nodeByCode.get('IDST 300')!]

/** Data-quality warnings the registrar should see. */
function findingsOf(data: Catalog): string[] {
  const codes = new Set(data.courses.flatMap(c => [...c.listings, ...(c.labs ?? []).map(l => l.code)]))
  const subjects = new Set(data.departments.map(d => d.subject))
  const out: string[] = []
  for (const c of data.courses) {
    for (const code of c.listings) if (!subjects.has(code.split(' ')[0])) out.push(`${code} is listed under a subject no department owns`)
    for (const r of c.requires ?? []) if (!codes.has(r.code)) out.push(`${c.listings[0]} requires ${r.code}, which is not in the catalog`)
  }
  for (const p of data.programmes) for (const code of p.courses) if (!codes.has(code)) out.push(`${p.name} lists ${code}, which is not in the catalog`)
  return out
}
const FINDINGS = findingsOf(catalog)

/** The library's presets, and the catalog's own: courses in rows by level. */
export const PRESETS: readonly TuningPreset[] = [
  ...TUNING_PRESETS,
  { label: 'By level', tuning: { forces: { bandY: { scalar: 'level' } } } },
]

export function App({ initialTheme = 'system', initialFocus }: { initialTheme?: ThemeChoice; initialFocus?: string | null }) {
  // Controlled: the details panel's "Show only <campus>" writes the filter.
  const [filter, setFilter] = React.useState<FilterState>(() => initialFilter(taxonomy, graph))
  const [themeChoice, setThemeChoice] = React.useState<ThemeChoice>(initialTheme)
  const [details, setDetails] = React.useState<GraphNode | null>(null)
  // Controlled: the panel's close clears it, and the view selects what it says.
  const [selected, setSelected] = React.useState<readonly GraphNode[]>(OPENING)
  // A request, not a state: the view applies it when it changes, and each ask
  // is a fresh one, so asking again for the same node asks again.
  const [focus, requestFocus] = useFocusRequest()
  React.useEffect(() => { if (initialFocus) requestFocus(initialFocus) }, [initialFocus, requestFocus])
  // Where the nodes last came to rest: a reload opens there.
  const [kept] = React.useState(() => loadPositions(localStorage))
  const [glowBy, setGlowBy] = React.useState<GlowBy>('programmes')


  /** Ask the view to reveal `node`: it widens the filter just enough, frames and selects. */
  const reveal = (node: GraphNode) => requestFocus(node.id)
  const onlyCampus = (campus: string) => setFilter(f => withChosen(f, CAMPUS, new Set([campus])))
  const glowSwitch = (
    <label>
      Glow by{' '}
      <select value={glowBy} onChange={e => setGlowBy(e.target.value as GlowBy)}>
        <option value="programmes">Programmes</option>
        <option value="campus">Campus</option>
      </select>
    </label>
  )

  return (
    <TaxonomyContext.Provider value={taxonomy}>
      <div className="catalog-app">
        <div className="catalog-pane">
          <GraphView
            graph={graph}
            labels={labels}
            counts="faceted"
            findings={FINDINGS.length > 0 && <Findings messages={FINDINGS} />}
            groups={groups}
            coloring={{ glow: GLOW[glowBy], ring: RING }}
            legend={(channels, control) => (
              <ColorLegend channels={channels} control={control} titles={{ fill: 'Kind', glow: glowBy === 'programmes' ? 'Degree programmes' : 'Campus', ring: 'Term' }}>
                {glowSwitch}
              </ColorLegend>
            )}
            presets={PRESETS}
            nodeAction={{ label: 'Open details', onSelect: setDetails }}
            onNodeActivate={setDetails}
            onEdgeHover={edge => console.log('edge hover', edge)}
            theme={themeChoice}
            onThemeChange={setThemeChoice}
            filter={filter}
            onFilterChange={setFilter}
            selectedIds={new Set(selected.map(n => n.id))}
            onSelectionChange={setSelected}
            focus={focus}
            defaultPositions={kept}
            onSettled={positions => savePositions(localStorage, positions)}
          />
        </div>
        {details && (
          <Details
            node={details}
            themeChoice={themeChoice}
            onReveal={reveal}
            onOnlyCampus={onlyCampus}
            onClose={() => { setDetails(null); setSelected([]) }}
          />
        )}
      </div>
    </TaxonomyContext.Provider>
  )
}

function Findings({ messages }: { messages: readonly string[] }) {
  return (
    <details className="catalog-findings">
      <summary>{messages.length} catalog warning{messages.length === 1 ? '' : 's'}</summary>
      <ul>{messages.map(m => <li key={m}>{m}</li>)}</ul>
    </details>
  )
}

/**
 * What "Open details" shows: the node the view hands over, and its listings —
 * the nodes that share its copy key — for the records the node does not carry.
 *
 * The panel sits beside the view, not above it, and resolves the view's choice
 * itself. On an ancestor of the view its theme would be the "host theme" the
 * view reads for `system`, and the choice would stop following the OS.
 */
function Details({ node, themeChoice, onReveal, onOnlyCampus, onClose }: {
  node: GraphNode
  themeChoice: ThemeChoice
  onReveal: (node: GraphNode) => void
  onOnlyCampus: (campus: string) => void
  onClose: () => void
}) {
  const entity = node.values[ENTITY] as Entity | undefined
  const campus = node.values[CAMPUS] as Campus | undefined
  const { scopeProps } = useScheme(taxonomy, { choice: themeChoice })
  const listings = [...(copies.get(copyKeyOf(node)) ?? [node.id])].flatMap(id => nodeById.get(id) ?? [])
  const first = listings[0]
  const course = catalog.courses.find(c => c.id === (first && payloadString(first, 'courseId')))
  const credits = first && payloadNumber(first, 'credits')
  return (
    <aside className="catalog-details" {...scopeProps}>
      <button className="catalog-close" onClick={onClose} aria-label="Close details">×</button>
      <div className="catalog-muted">{entity ? taxonomy.styleOf(entity).label : 'Unknown'}</div>
      <h2>{node.name}</h2>
      <dl>
        {listings.length > 0 && <><dt>Listed as</dt><dd>{listings.map(n => payloadString(n, 'code')).filter(Boolean).join(', ') || '—'}</dd></>}
        {credits !== undefined && <><dt>Credits</dt><dd>{credits}</dd></>}
        {first && payloadString(first, 'term') && <><dt>Term</dt><dd>{payloadString(first, 'term')}</dd></>}
        {first && payloadString(first, 'dean') && <><dt>Dean</dt><dd>{payloadString(first, 'dean')}</dd></>}
        {campus && <><dt>Campus</dt><dd>{CAMPUS_LABEL[campus]}</dd></>}
      </dl>
      {campus && (
        <button onClick={() => onOnlyCampus(campus)}>Show only {CAMPUS_LABEL[campus]}</button>
      )}
      {course?.requires && (
        <>
          <h3>Requires</h3>
          <ul className="catalog-requires">
            {course.requires.map(r => {
              const node = nodeByCode.get(r.code)
              return (
                <li key={r.code}>
                  <span className={`catalog-req catalog-req-${r.kind}`}>{r.kind}</span> {r.code}
                  {node ? <button onClick={() => onReveal(node)}>Reveal</button> : <span className="catalog-missing">missing</span>}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </aside>
  )
}
