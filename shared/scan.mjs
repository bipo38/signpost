// Pure scan core shared by the Node server and the browser (GitHub mode). No imports, no filesystem:
// callers hand over the list of every .md path in the repo and a read(path) -> text function.
export const ENTRIES = ['CLAUDE.md', 'AGENTS.md']
export const SKIP = ['node_modules', '.git', 'dist', 'vendor'] // folders never scanned or listed
export const FIXABLE = /^\s*(\||See also\b|Related:)/ // lines Signpost may clean without touching prose
const LINK = /`([\w./-]+\.md)`|\]\(([\w./-]+\.md)\)/g
const skipped = (p) => p.split('/').some((s) => SKIP.includes(s))
const normDocs = (docs) => docs.replace(/\/+$/, '') || '.'

// The .md files under `docs` ('.' = whole repo).
export function docsUnder(paths, docs) {
  const d = normDocs(docs)
  const prefix = d === '.' ? '' : `${d}/`
  return paths.filter((p) => p.startsWith(prefix) && p.endsWith('.md') && !skipped(p))
}

// Every folder holding at least one .md (counts include subfolders), '.' first.
export function foldersOf(paths) {
  const count = new Map()
  for (const p of paths.filter((p) => p.endsWith('.md') && !skipped(p))) {
    const parts = p.split('/').slice(0, -1)
    count.set('.', (count.get('.') ?? 0) + 1)
    for (let i = 1; i <= parts.length; i++) {
      const f = parts.slice(0, i).join('/')
      count.set(f, (count.get(f) ?? 0) + 1)
    }
  }
  return [...count].map(([path, count]) => ({ path, count })).sort((a, b) => (a.path === '.' ? -1 : b.path === '.' ? 1 : a.path.localeCompare(b.path)))
}

// Join `ref` onto folder `base` ('' = root); null when it climbs above the root.
function joinPath(base, ref) {
  const out = base ? base.split('/') : []
  for (const s of ref.split('/')) {
    if (s === '..') { if (!out.length) return null; out.pop() }
    else if (s && s !== '.') out.push(s)
  }
  return out.join('/')
}

// Resolve a reference against the root, then against the referencing file's folder.
function resolveRef(have, from, ref) {
  for (const base of ['', from.split('/').slice(0, -1).join('/')]) {
    const p = joinPath(base, ref)
    if (p && have.has(p)) return p
  }
  return null
}

const titleOf = (text) => text.match(/^# (.+)$/m)?.[1]

export function scanFiles({ docs = 'docs', paths, read }) {
  docs = normDocs(docs)
  const have = new Set(paths)
  const entry = ENTRIES.find((f) => have.has(f)) ?? ENTRIES[0]
  const nodes = new Set([...(have.has(entry) ? [entry] : []), ...docsUnder(paths, docs)])
  const texts = new Map()
  const text = (p) => { if (!texts.has(p)) texts.set(p, read(p) ?? ''); return texts.get(p) }
  const edges = new Map()
  const broken = [] // references to .md files that do not exist (deleted or renamed)
  // Snapshot: docs pulled in only by a link become nodes but are not scanned for their own links.
  for (const from of [...nodes]) {
    text(from).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(LINK)) {
        const ref = m[1] ?? m[2]
        const to = resolveRef(have, from, ref)
        if (!to) {
          if (!broken.some((b) => b.from === from && b.line === i + 1 && b.ref === ref)) broken.push({ from, ref, line: i + 1, text: line.trim(), fixable: FIXABLE.test(line) })
          continue
        }
        if (to === from) continue
        nodes.add(to)
        edges.set(`${from}|${to}`, (edges.get(`${from}|${to}`) ?? 0) + 1)
      }
    })
  }
  return {
    entry, docs,
    nodes: [...nodes].map((path) => ({ path, title: titleOf(text(path)) ?? path })),
    edges: [...edges].map(([k, count]) => { const [from, to] = k.split('|'); return { from, to, count } }),
    returnTables: [...nodes].filter((n) => /^\| *Came from/m.test(text(n))),
    broken,
  }
}
