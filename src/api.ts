import { ENTRIES, docsUnder, foldersOf, scanFiles, type Folder } from '../shared/scan.mjs'

export type { Folder }
export interface Node { path: string; title: string }
export interface Edge { from: string; to: string; count: number }
export interface Broken { from: string; ref: string; line: number; text: string; fixable: boolean }
export interface Graph { root: string; entry: string; docs: string; nodes: Node[]; edges: Edge[]; returnTables: string[]; broken: Broken[] }

// Where the graph comes from is decided by the URL: ?repo=owner/name reads a public GitHub repo in the
// browser (read-only); otherwise the local server. ?docs= picks the folder in both cases.
const params = new URLSearchParams(location.search)
export const repo = params.get('repo')
// Anything not served from localhost is the hosted build, which has no local server behind it.
export const hosted = !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)
export const readOnly = repo !== null || hosted
export let docs: string | undefined = params.get('docs') ?? undefined
export function setDocs(d: string) {
  docs = d
  params.set('docs', d)
  history.replaceState(null, '', `?${params}`)
}
const q = (extra: Record<string, string> = {}) => {
  const u = new URLSearchParams(extra)
  if (docs) u.set('docs', docs)
  return u.size ? `?${u}` : ''
}

async function ok<T>(r: Response): Promise<T> {
  let body: { error?: string } & T
  try { body = JSON.parse(await r.text()) } catch { throw new Error(r.ok ? 'unexpected response from the server' : `${r.status} ${r.statusText}`) }
  if (!r.ok) throw new Error(body.error ?? r.statusText)
  return body
}

const local = {
  folders: () => fetch('/api/folders').then((r) => ok<Folder[]>(r)),
  graph: () => fetch(`/api/graph${q()}`).then((r) => ok<Graph>(r)),
  file: (p: string) => fetch(`/api/file${q({ p })}`).then((r) => ok<{ path: string; content: string }>(r)),
  unlink: (from: string, ref: string, line: number) =>
    fetch(`/api/unlink${q()}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from, ref, line }) }).then((r) => ok<{ removed: number }>(r)),
  relink: (from: string, ref: string, to: string, line: number) =>
    fetch(`/api/relink${q()}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ from, ref, to, line }) }).then((r) => ok<{ changed: number }>(r)),
  create: (form: FormData) => fetch(`/api/create${q()}`, { method: 'POST', body: form }).then((r) => ok<{ path: string }>(r)),
}

// GitHub mode: one API call for the file listing, then raw fetches for the docs, then the same scan core.
function github(repo: string, ref = 'HEAD'): typeof local {
  const texts = new Map<string, string>()
  let tree: Promise<string[]> | undefined
  const paths = () => (tree ??= fetch(`https://api.github.com/repos/${repo}/git/trees/${ref}?recursive=1`).then(async (r) => {
    if (r.status === 404) throw new Error(`${repo} not found on GitHub. Private repos need a login Signpost does not have.`)
    if (r.status === 403 || r.status === 429) throw new Error('GitHub API rate limit reached (60 requests per hour per IP). Try again later.')
    if (!r.ok) throw new Error(`GitHub: ${r.status} ${r.statusText}`)
    const t = (await r.json()) as { truncated: boolean; tree: { path: string; type: string }[] }
    if (t.truncated) console.warn('GitHub returned a truncated tree; some files are missing from the graph')
    return t.tree.filter((e) => e.type === 'blob' && e.path.endsWith('.md')).map((e) => e.path)
  }))
  const fill = (ps: string[]) => Promise.all(ps.filter((p) => !texts.has(p)).map(async (p) => {
    const r = await fetch(`https://raw.githubusercontent.com/${repo}/${ref}/${p}`)
    if (!r.ok) throw new Error(`${p}: ${r.status}`)
    texts.set(p, await r.text())
  }))
  const deny = () => Promise.reject(new Error('read-only: the web version cannot write to a repo'))
  return {
    folders: async () => foldersOf(await paths()),
    graph: async () => {
      const all = await paths()
      const d = docs ?? 'docs'
      await fill([...ENTRIES.filter((e) => all.includes(e)), ...docsUnder(all, d)])
      const run = () => scanFiles({ docs: d, paths: all, read: (p) => texts.get(p) })
      let g = run()
      // Docs referenced from outside the folder (a PRODUCT.md at the root) still need their text for titles.
      const missing = g.nodes.map((n) => n.path).filter((p) => !texts.has(p))
      if (missing.length) { await fill(missing); g = run() }
      return { root: repo, ...g }
    },
    file: async (p: string) => { await fill([p]); return { path: p, content: texts.get(p)! } },
    unlink: deny,
    relink: deny,
    create: deny,
  }
}

const refuse = (why: string): typeof local => {
  const deny = () => Promise.reject(new Error(why))
  return { folders: deny, graph: deny, file: deny, unlink: deny, relink: deny, create: deny }
}
export const api = repo && /^[\w.-]+\/[\w.-]+$/.test(repo)
  ? github(repo, params.get('ref') ?? undefined)
  : repo
    ? refuse(`"${repo}" is not a repository. Use owner/name.`)
    : hosted
      ? refuse('No repository given. Open the graph from the landing page, or add ?repo=owner/name to the URL.')
      : local
