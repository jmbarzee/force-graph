// The translation step: a catalog in, a `Graph` out. One node per faculty,
// department, course listing and lab; a cross-listed course becomes one node
// per listing, sharing a `copyKey`. A course and its labs carry the programmes
// that list any of their codes, which `programmeGroups` reads.

import type { DerivedGroups, Graph, GraphEdge, GraphNode, TimeWindow } from '@jmbarzee/force-graph'
import type { Catalog, Requirement } from './data'
import { CAMPUS, ENTITY, REQUIREMENT } from './taxonomy'

const subjectOf = (code: string) => code.split(' ')[0]
/** "MATH 210" → 2; "CHEM 101L" → 1. */
const levelOf = (code: string) => Number(code.split(' ')[1]?.[0] ?? 0)
/** The ids of the programmes that list any of `codes`. */
const programmesOf = (catalog: Catalog, codes: readonly string[]) =>
  catalog.programmes.filter(p => p.courses.some(code => codes.includes(code))).map(p => p.id)

/** A twelve-week term, a bucket a week. */
const TERM: TimeWindow = { since: Date.UTC(2026, 0, 5), until: Date.UTC(2026, 2, 30), buckets: 12 }
/** How often a requirement is looked up, by week of the term. */
const PROFILE = [2, 5, 8, 6, 4, 3, 3, 4, 6, 9, 7, 3]
/** The profile `level` weeks later, wrapping so that every level totals the same, scaled by `credits`. */
const lookups = (level: number, credits: number) => PROFILE.map((_, i) => PROFILE[(i - level + PROFILE.length) % PROFILE.length]! * credits)

export function buildGraph(catalog: Catalog): Graph {
  const nodes: GraphNode[] = []
  /** Ids added so far, for the department lookup below. */
  const ids = new Set<string>()
  const edges: GraphEdge[] = []
  /** Catalog code → node id, so requirements can resolve. */
  const byCode = new Map<string, string>()
  /** Catalog code → credits, which weight the requirements on it. */
  const credits = new Map<string, number>()

  // Containment is `parentId` and nothing else: the library derives the
  // containment edge from it, so only dependencies are listed as edges — and
  // a dependency is the relation an edge has when it says none.
  const add = (node: GraphNode) => { nodes.push(node); ids.add(node.id) }
  const depends = (from: string, req: Requirement) => {
    const to = byCode.get(req.code)
    if (!to) return // reported as a finding by the host shell
    const weighs = credits.get(req.code)!
    edges.push({
      id: `${req.kind}:${from}->${to}`,
      sourceId: from,
      targetId: to,
      values: { [REQUIREMENT]: req.kind },
      weight: weighs / heaviest,
      series: lookups(levelOf(req.code), weighs),
    })
  }

  for (const f of catalog.faculties) {
    add({
      id: `faculty:${f.id}`,
      name: f.name,
      copyKey: `faculty:${f.id}`,
      values: { [ENTITY]: 'faculty' },
      payload: { dean: f.dean },
    })
  }
  for (const d of catalog.departments) {
    add({
      id: `dept:${d.subject}`,
      name: d.name,
      copyKey: `dept:${d.subject}`,
      parentId: `faculty:${d.faculty}`,
      values: { [ENTITY]: 'department' },
      payload: { code: d.subject },
    })
  }
  for (const c of catalog.courses) {
    const programmes = programmesOf(catalog, c.listings)
    for (const code of c.listings) {
      const dept = ids.has(`dept:${subjectOf(code)}`) ? `dept:${subjectOf(code)}` : undefined
      byCode.set(code, `course:${code}`)
      credits.set(code, c.credits)
      add({
        id: `course:${code}`,
        name: c.title,
        copyKey: `course:${c.id}`,
        parentId: dept,
        values: { [ENTITY]: 'course', [CAMPUS]: c.campus },
        payload: {
          code,
          credits: c.credits,
          term: c.term,
          level: levelOf(code),
          courseId: c.id,
          programmes,
        },
        // A listing under a subject no department owns is set apart: the ring.
        ring: dept === undefined ? 'dashed' : undefined,
        stack: (c.sections ?? 1) > 1,
      })
    }
    // Labs belong to the course, not to a listing: they sit under the first.
    for (const lab of c.labs ?? []) {
      byCode.set(lab.code, `lab:${lab.code}`)
      credits.set(lab.code, lab.credits)
      add({
        id: `lab:${lab.code}`,
        name: lab.title,
        copyKey: `lab:${lab.code}`,
        parentId: `course:${c.listings[0]}`,
        values: { [ENTITY]: 'lab', [CAMPUS]: c.campus },
        payload: {
          code: lab.code,
          credits: lab.credits,
          term: c.term,
          level: levelOf(lab.code),
          programmes: [...new Set([...programmes, ...programmesOf(catalog, [lab.code])])],
        },
        stack: (lab.sections ?? 1) > 1,
      })
    }
  }
  // Requirements last, once every code has a node. Each listing carries its course's.
  const heaviest = Math.max(...credits.values())
  for (const c of catalog.courses) {
    for (const code of c.listings) for (const req of c.requires ?? []) depends(`course:${code}`, req)
    for (const lab of c.labs ?? []) for (const req of lab.requires ?? []) depends(`lab:${lab.code}`, req)
  }

  return { nodes, edges, window: TERM }
}

/** Every programme as a group, in the catalog's order; a node belongs to the ones its `programmes` name. */
export function programmeGroups(catalog: Catalog): DerivedGroups {
  return {
    keys: catalog.programmes.map(p => ({ id: p.id, label: p.name })),
    of: node => (node.payload?.programmes ?? []) as string[],
  }
}
