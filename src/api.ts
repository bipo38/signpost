export interface Node { path: string; title: string }
export interface Edge { from: string; to: string; count: number }
export interface Graph { root: string; entry: string; docs: string; nodes: Node[]; edges: Edge[]; returnTables: string[] }

async function ok<T>(r: Response): Promise<T> {
  const body = await r.json()
  if (!r.ok) throw new Error(body.error ?? r.statusText)
  return body
}

export const api = {
  graph: () => fetch('/api/graph').then((r) => ok<Graph>(r)),
  file: (p: string) => fetch(`/api/file?p=${encodeURIComponent(p)}`).then((r) => ok<{ path: string; content: string }>(r)),
  create: (form: FormData) => fetch('/api/create', { method: 'POST', body: form }).then((r) => ok<{ path: string }>(r)),
}
