// The host shell, leaning on the view's defaults. It controls the state its own
// panel writes (the filter) or follows (the selection, which closing the panel
// clears), hands the theme choice in from the URL, asks the view to reveal a
// node by naming it (`focus`), keeps where the nodes came to rest across a
// reload, and leaves the axes, the locks and the search to the view. It
// supplies what only the host can know — findings, programme groups, and what
// "Open details" does.

import React from 'react'
import {
  GraphView, GroupLegend, TaxonomyContext, copyGroups, initialFilter, nodesById, payloadNumber, payloadString, useFocusRequest, useScheme, withSelection,
} from '@jmbarzee/force-graph'
import type {
  FilterState, GraphNode, ThemeChoice,
} from '@jmbarzee/force-graph'
import { catalog } from './data'
import type { Campus, Catalog } from './data'
import { buildGraph, programmeGroups } from './graph'
import { loadPositions, savePositions } from './positions'
import { CAMPUS, CAMPUS_LABEL, ENTITY, taxonomy } from './taxonomy'
import type { Entity } from './taxonomy'
import './app.css'

const graph = buildGraph(catalog)
const nodeById = nodesById(graph.nodes)
const nodeByCode = new Map(graph.nodes.map(n => [payloadString(n, 'code') ?? n.id, n]))
const copies = copyGroups(graph)
const groups = programmeGroups(catalog)

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

export function App({ initialTheme = 'system' }: { initialTheme?: ThemeChoice }) {
  // Controlled: the details panel's "Show only <campus>" writes the filter.
  const [filter, setFilter] = React.useState<FilterState>(() => initialFilter(taxonomy, graph))
  const [themeChoice, setThemeChoice] = React.useState<ThemeChoice>(initialTheme)
  const [details, setDetails] = React.useState<GraphNode | null>(null)
  // Controlled: the panel's close clears it, and the view selects what it says.
  const [selected, setSelected] = React.useState<GraphNode | null>(null)
  // A request, not a state: the view applies it when it changes, and each ask
  // is a fresh one, so asking again for the same node asks again.
  const [focus, requestFocus] = useFocusRequest()
  // Where the nodes last came to rest: a reload opens there.
  const [kept] = React.useState(() => loadPositions(localStorage))


  /** Ask the view to reveal `node`: it widens the filter just enough, frames and selects. */
  const reveal = (node: GraphNode) => requestFocus(node.id)
  const onlyCampus = (campus: string) => setFilter(f => withSelection(f, CAMPUS, new Set([campus])))

  return (
    <TaxonomyContext.Provider value={taxonomy}>
      <div className="catalog-app">
        <div className="catalog-pane">
          <GraphView
            graph={graph}
            counts="faceted"
            findings={FINDINGS.length > 0 && <Findings messages={FINDINGS} />}
            groups={groups}
            groupsControl={(active, control) => (
              <GroupLegend title="Degree programmes" items={groups.keys} active={active} control={control} />
            )}
            nodeAction={{ label: 'Open details', onSelect: setDetails }}
            onNodeActivate={setDetails}
            theme={themeChoice}
            onThemeChange={setThemeChoice}
            filter={filter}
            onFilterChange={setFilter}
            selectedId={selected?.id ?? null}
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
            onClose={() => { setDetails(null); setSelected(null) }}
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
  const listings = [...(copies.get(node.copyKey ?? node.id) ?? [node.id])].flatMap(id => nodeById.get(id) ?? [])
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
