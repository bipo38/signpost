import { test } from 'node:test'
import assert from 'node:assert/strict'
import { docsUnder, foldersOf, scanFiles } from './scan.mjs'

const files = new Map([
  ['CLAUDE.md', '# Repo\n\n| Situation | Open |\n|---|---|\n| Dev | `docs/plan.md` |\n\nRules in `docs/plan-mode.md`. Voice: `PRODUCT.md`.\n'],
  ['PRODUCT.md', '# Product\n\nSee `docs/plan.md` for the flow.\n'],
  ['docs/plan.md', '# Develop flow\n\nSee `docs/plan-mode.md` and [ui](testing/ui.md). Never `../../etc/x.md`.\n'],
  ['docs/plan-mode.md', '# Plan\n\n| Came from | Return to |\n|---|---|\n| `docs/plan.md` | `docs/plan.md` |\n| Any other doc | That doc |\n'],
  ['docs/testing/ui.md', '# UI\n\nBack to `docs/plan.md`.\n'],
  ['node_modules/pkg/README.md', '# ignored\n'],
  ['../../etc/x.md', 'never reachable'],
])
const paths = [...files.keys()]
const scan = (docs) => scanFiles({ docs, paths, read: (p) => files.get(p) })

test('scanFiles finds nodes, counts edges, resolves relative links, spots return tables and titles', () => {
  const g = scan('docs')
  assert.equal(g.entry, 'CLAUDE.md')
  assert.deepEqual(g.nodes.map((n) => n.path).sort(), ['CLAUDE.md', 'PRODUCT.md', 'docs/plan-mode.md', 'docs/plan.md', 'docs/testing/ui.md'])
  assert.deepEqual(g.edges.find((e) => e.from === 'docs/plan.md' && e.to === 'docs/testing/ui.md'), { from: 'docs/plan.md', to: 'docs/testing/ui.md', count: 1 })
  assert.deepEqual(g.returnTables, ['docs/plan-mode.md'])
  assert.equal(g.nodes.find((n) => n.path === 'docs/plan.md').title, 'Develop flow')
})

test('a doc referenced from outside the folder is a node with a title but no outgoing edges', () => {
  const g = scan('docs')
  assert.equal(g.nodes.find((n) => n.path === 'PRODUCT.md').title, 'Product')
  assert.equal(g.edges.filter((e) => e.from === 'PRODUCT.md').length, 0)
})

test('references that climb above the root never resolve and are reported as broken', () => {
  const g = scan('docs')
  assert.deepEqual(g.broken.map((b) => [b.from, b.ref, b.line, b.fixable]), [['docs/plan.md', '../../etc/x.md', 3, false]])
})

test('docsUnder handles the whole repo, trailing slashes and skipped folders', () => {
  assert.deepEqual(docsUnder(paths, '.').sort(), ['../../etc/x.md', 'CLAUDE.md', 'PRODUCT.md', 'docs/plan-mode.md', 'docs/plan.md', 'docs/testing/ui.md'])
  assert.deepEqual(docsUnder(paths, 'docs/testing/'), ['docs/testing/ui.md'])
  assert.equal(scan('.').nodes.length, 6)
  assert.equal(scan('docs/').docs, 'docs')
})

test('foldersOf counts recursively, puts the root first and skips node_modules', () => {
  assert.deepEqual(foldersOf(['CLAUDE.md', 'docs/a.md', 'docs/b.md', 'docs/testing/c.md', 'specs/d.md', 'node_modules/x/README.md']), [
    { path: '.', count: 5 },
    { path: 'docs', count: 3 },
    { path: 'docs/testing', count: 1 },
    { path: 'specs', count: 1 },
  ])
})
