// Pure filesystem logic: scan the docs graph, create a wired-in doc. No deps.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const LINK = /`([\w./-]+\.md)`|\]\(([\w./-]+\.md)\)/g
const ENTRIES = ['CLAUDE.md', 'AGENTS.md']

export function findEntry(root) {
  return ENTRIES.find((f) => existsSync(join(root, f))) ?? ENTRIES[0]
}

// Resolve a referenced path against the root, then against the referencing file's dir.
function resolveRef(root, from, ref) {
  for (const base of [root, join(root, dirname(from))]) {
    const abs = resolve(base, ref)
    if (abs.startsWith(root) && existsSync(abs) && statSync(abs).isFile()) return relative(root, abs)
  }
  return null
}

export function scan(root, { docs = 'docs', ignore = ['guide', 'node_modules'] } = {}) {
  const entry = findEntry(root)
  const nodes = new Set(existsSync(join(root, entry)) ? [entry] : [])
  if (existsSync(join(root, docs)))
    for (const f of readdirSync(join(root, docs), { recursive: true }))
      if (f.endsWith('.md') && !ignore.some((i) => f.split('/').includes(i))) nodes.add(`${docs}/${f}`)
  const edges = new Map()
  for (const from of [...nodes])
    for (const m of readFileSync(join(root, from), 'utf8').matchAll(LINK)) {
      const to = resolveRef(root, from, m[1] ?? m[2])
      if (!to || to === from) continue
      nodes.add(to)
      edges.set(`${from}|${to}`, (edges.get(`${from}|${to}`) ?? 0) + 1)
    }
  const returnTables = [...nodes].filter((n) => /^\| *Came from/m.test(readFileSync(join(root, n), 'utf8')))
  return {
    root, entry, docs,
    nodes: [...nodes].map((path) => ({ path, title: titleOf(readFileSync(join(root, path), 'utf8')) ?? path })),
    edges: [...edges].map(([k, count]) => { const [from, to] = k.split('|'); return { from, to, count } }),
    returnTables,
  }
}

const titleOf = (text) => text.match(/^# (.+)$/m)?.[1]

// Insert `row` after the last row of the first table in `text` (or the table under `heading`).
export function insertRow(text, row, heading) {
  const lines = text.split('\n')
  let i = heading ? lines.findIndex((l) => l.startsWith(heading)) : 0
  if (i < 0) i = 0
  while (i < lines.length && !lines[i].startsWith('|')) i++
  if (i === lines.length) return null
  while (i < lines.length - 1 && lines[i + 1].startsWith('|')) i++
  lines.splice(i + 1, 0, row)
  return lines.join('\n')
}

export function create(root, { path, situation, body, parents = [], links = [], returnRows = [] }, opts = {}) {
  if (!/^[\w-]+(\/[\w-]+)*\.md$/.test(path) || path.split('/').length < 2) throw new Error('path must look like docs/**/name.md')
  if (existsSync(join(root, path))) throw new Error(`${path} already exists`)
  if (!situation?.trim()) throw new Error('situation is required')
  const known = new Set(scan(root, opts).nodes.map((n) => n.path))
  for (const p of [...parents, ...links, ...returnRows]) if (!known.has(p)) throw new Error(`${p} is not a doc in this graph`)
  const caller = parents[0] ?? findEntry(root)
  const slug = path.split('/').pop().replace('.md', '')
  const title = slug.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase())
  body ||= `# ${title}\n\n${situation}\n\nEntered from \`${caller}\`. When finished, return to \`${caller}\`.\n`
  if (links.length) body = `${body.trimEnd()}\n\nRelated: ${links.map((l) => `\`${l}\``).join(', ')}.\n`
  mkdirSync(dirname(join(root, path)), { recursive: true })
  writeFileSync(join(root, path), body)
  for (const p of parents) {
    const file = join(root, p)
    const text = readFileSync(file, 'utf8')
    const withRow = ENTRIES.includes(p) ? insertRow(text, `| ${situation} | \`${path}\` |`) : null
    writeFileSync(file, withRow ?? `${text.trimEnd()}\n\nSee also \`${path}\` — ${situation}.\n`)
  }
  for (const r of returnRows) {
    const file = join(root, r)
    const text = readFileSync(file, 'utf8')
    const row = `| \`${path}\` | \`${path}\` (continue ${slug} flow) |`
    writeFileSync(file, /^\| Any other/m.test(text) ? text.replace(/^\| Any other/m, `${row}\n| Any other`) : (insertRow(text, row, '| Came from') ?? text))
  }
  return path
}
