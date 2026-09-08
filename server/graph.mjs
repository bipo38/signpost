// Filesystem layer over the shared scan core: list and read the repo's markdown, create and edit docs.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { ENTRIES, FIXABLE, SKIP, scanFiles } from '../shared/scan.mjs'

export function findEntry(root) {
  return ENTRIES.find((f) => existsSync(join(root, f))) ?? ENTRIES[0]
}

// Every .md under root, pruned of SKIP folders. Symlinked directories are not followed.
function* walk(dir, rel = '') {
  for (const d of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.includes(d.name)) continue
    const p = rel ? `${rel}/${d.name}` : d.name
    if (d.isDirectory()) yield* walk(join(dir, d.name), p)
    else if (p.endsWith('.md')) yield p
  }
}
export const mdPaths = (root) => [...walk(root)]

// ponytail: walks the whole repo on every request; give scanFiles an exists() callback if monorepos hurt.
export const scan = (root, { docs = 'docs' } = {}) => ({ root, ...scanFiles({ docs, paths: mdPaths(root), read: (p) => readFileSync(join(root, p), 'utf8') }) })

// Remove the fixable references to `ref` in `from`, on every line or only on `line` (1-based). Table rows
// and "See also" lines are dropped; in a "Related:" list only that entry goes, the line goes when the list
// is empty. Prose is left alone.
export function unlink(root, from, ref, only) {
  const file = join(root, from)
  const lines = readFileSync(file, 'utf8').split('\n')
  let removed = 0
  const out = []
  lines.forEach((line, i) => {
    if ((only && i + 1 !== only) || !line.includes(ref) || !FIXABLE.test(line)) { out.push(line); return }
    if (/^\s*Related:/.test(line)) {
      const rest = line.replace(/^\s*Related:\s*/, '').replace(/\.\s*$/, '').split(/,\s*/).filter((e) => !e.includes(ref))
      removed++
      if (rest.length) out.push(`Related: ${rest.join(', ')}.`)
      return
    }
    removed++ // table row or See also line: drop it
  })
  if (removed) writeFileSync(file, out.join('\n').replace(/\n{3,}/g, '\n\n'))
  return removed
}

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

// Rewrite the references to `ref` in `from`, on every line or only on `line` (1-based): with `to` set, point
// them at `to`; with `to` empty, strip the reference itself (a backticked path disappears, a markdown link
// keeps its text). Prose stays otherwise intact.
export function relink(root, from, ref, to, only) {
  const file = join(root, from)
  const esc = ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  let n = 0
  const fix = (line) => line
    .replace(new RegExp('`' + esc + '`', 'g'), () => { n++; return to ? '`' + to + '`' : '' })
    .replace(new RegExp('\\[([^\\]]*)\\]\\(' + esc + '\\)', 'g'), (_, label) => { n++; return to ? `[${label}](${to})` : label })
    .replace(/ {2,}([.,;)])/g, '$1').replace(/\( +/g, '(').replace(/ +\)/g, ')')
  const text = readFileSync(file, 'utf8').split('\n').map((l, i) => (only && i + 1 !== only ? l : fix(l))).join('\n')
  if (n) writeFileSync(file, text)
  return n
}
