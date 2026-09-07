import dagre from '@dagrejs/dagre'
import type { Edge as FlowEdge, Node as FlowNode } from '@vue-flow/core'
import type { Graph } from './api'

export const NODE_W = 220
export const NODE_H = 64

export function toFlow(g: Graph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const dg = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}))
  dg.setGraph({ rankdir: 'LR', nodesep: 28, ranksep: 90, marginx: 20, marginy: 20 })
  for (const n of g.nodes) dg.setNode(n.path, { width: NODE_W, height: NODE_H })
  for (const e of g.edges) dg.setEdge(e.from, e.to)
  dagre.layout(dg)

  const inbound = new Map<string, number>()
  const outbound = new Map<string, number>()
  for (const e of g.edges) {
    inbound.set(e.to, (inbound.get(e.to) ?? 0) + e.count)
    outbound.set(e.from, (outbound.get(e.from) ?? 0) + e.count)
  }

  return {
    nodes: g.nodes.map((n) => {
      const { x, y } = dg.node(n.path)
      return {
        id: n.path,
        type: 'doc',
        position: { x: x - NODE_W / 2, y: y - NODE_H / 2 },
        data: { ...n, entry: n.path === g.entry, inbound: inbound.get(n.path) ?? 0, outbound: outbound.get(n.path) ?? 0 },
      }
    }),
    edges: g.edges.map((e) => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      label: e.count > 1 ? String(e.count) : undefined,
      type: 'default',
      markerEnd: 'arrowclosed',
    })),
  }
}
