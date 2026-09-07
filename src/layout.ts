import type { Edge as FlowEdge, Node as FlowNode } from '@vue-flow/core'
import type { Graph } from './api'

export const NODE_W = 220
export const NODE_H = 64
const GAP_X = 40
const GAP_Y = 24
const RANK_GAP = 120
const MAX_ROWS = 14

// Dense graphs (hundreds of edges) only draw the edges of the selected or hovered doc.
export const DENSE_EDGES = 250

export const folderOf = (p: string) => p.split('/').slice(0, -1).join('/')

// Stable hue per folder, so cards cluster visually without a legend. Root files stay neutral.
export function folderColor(path: string): string {
  const folder = folderOf(path)
  if (!folder) return 'var(--muted-foreground)'
  let h = 0
  for (const c of folder) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return `oklch(0.72 0.13 ${h % 360})`
}

export interface Placed { id: string; x: number; y: number }

// Rank = shortest link distance from the entry doc. Unreachable docs go in a final rank.
// Inside a rank, docs cluster by folder, then by the average row of their referrers
// (one barycenter sweep, so most links go roughly straight), then by name.
// Ranks taller than MAX_ROWS wrap into extra columns.
// ponytail: O(V+E), no crossing minimisation beyond one sweep — dagre took 12 s on 200 docs.
export function place(nodes: string[], edges: { from: string; to: string }[], entry: string): Placed[] {
  const out = new Map<string, string[]>()
  const inn = new Map<string, string[]>()
  for (const e of edges) {
    out.set(e.from, [...(out.get(e.from) ?? []), e.to])
    inn.set(e.to, [...(inn.get(e.to) ?? []), e.from])
  }
  const rank = new Map<string, number>()
  const queue = nodes.includes(entry) ? [entry] : []
  if (queue.length) rank.set(entry, 0)
  while (queue.length) {
    const n = queue.shift()!
    for (const m of out.get(n) ?? []) if (!rank.has(m)) { rank.set(m, rank.get(n)! + 1); queue.push(m) }
  }
  const last = Math.max(-1, ...rank.values()) + 1
  for (const n of nodes) if (!rank.has(n)) rank.set(n, last)

  const ranks: string[][] = []
  for (const [p, r] of rank) (ranks[r] ??= []).push(p)

  const row = new Map<string, number>()
  const placed: Placed[] = []
  let x = 0
  for (const col of ranks.filter(Boolean)) {
    const bary = (p: string) => {
      const rows = (inn.get(p) ?? []).filter((q) => row.has(q)).map((q) => row.get(q)!)
      return rows.length ? rows.reduce((a, b) => a + b, 0) / rows.length : Number.POSITIVE_INFINITY
    }
    col.sort((a, b) => folderOf(a).localeCompare(folderOf(b)) || bary(a) - bary(b) || a.localeCompare(b))
    const rows = Math.min(col.length, MAX_ROWS)
    const cols = Math.ceil(col.length / MAX_ROWS)
    const top = -(rows * (NODE_H + GAP_Y)) / 2
    col.forEach((p, i) => {
      row.set(p, i % MAX_ROWS)
      placed.push({ id: p, x: x + Math.floor(i / MAX_ROWS) * (NODE_W + GAP_X), y: top + (i % MAX_ROWS) * (NODE_H + GAP_Y) })
    })
    x += cols * (NODE_W + GAP_X) - GAP_X + RANK_GAP
  }
  return placed
}

export function toFlow(g: Graph): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const inbound = new Map<string, number>()
  const outbound = new Map<string, number>()
  for (const e of g.edges) {
    inbound.set(e.to, (inbound.get(e.to) ?? 0) + e.count)
    outbound.set(e.from, (outbound.get(e.from) ?? 0) + e.count)
  }
  const at = new Map(place(g.nodes.map((n) => n.path), g.edges, g.entry).map((p) => [p.id, p]))
  const dense = g.edges.length > DENSE_EDGES
  return {
    nodes: g.nodes.map((n) => ({
      id: n.path,
      type: 'doc',
      position: { x: at.get(n.path)!.x, y: at.get(n.path)!.y },
      data: { ...n, entry: n.path === g.entry, inbound: inbound.get(n.path) ?? 0, outbound: outbound.get(n.path) ?? 0, color: folderColor(n.path) },
    })),
    edges: g.edges.map((e) => ({
      id: `${e.from}->${e.to}`,
      source: e.from,
      target: e.to,
      label: e.count > 1 ? String(e.count) : undefined,
      type: 'default',
      markerEnd: 'arrowclosed',
      hidden: dense,
    })),
  }
}
