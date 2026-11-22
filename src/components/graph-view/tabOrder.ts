import type { GraphNode } from '../../graph/model'

type NodeOf = (id: string) => Pick<GraphNode, 'parentId'> | undefined

/** `id` and its containers by `parentId`, nearest first. */
export function ancestry(id: string, nodeOf: NodeOf): string[] {
  const path = [id]
  for (let at = nodeOf(id)?.parentId; at !== undefined && !path.includes(at); at = nodeOf(at)?.parentId) path.push(at)
  return path
}

/** The drawn nodes depth-first by containment, each under its nearest drawn container, siblings by name. */
export function tabOrder(drawn: readonly GraphNode[], nodeOf: NodeOf): string[] {
  const ids = new Set(drawn.map(n => n.id))
  const children = new Map<string | undefined, GraphNode[]>()
  for (const node of drawn) {
    const container = ancestry(node.id, nodeOf).slice(1).find(id => ids.has(id))
    const siblings = children.get(container)
    if (siblings) siblings.push(node); else children.set(container, [node])
  }
  const order: string[] = []
  const visit = (container: string | undefined) => {
    const siblings = children.get(container)?.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
    for (const node of siblings ?? []) { order.push(node.id); visit(node.id) }
  }
  visit(undefined)
  return order
}
