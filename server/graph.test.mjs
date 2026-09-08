import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { create, insertRow, mdPaths, relink, scan, unlink } from './graph.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'ctx-'))
  mkdirSync(join(root, 'docs/testing'), { recursive: true })
  writeFileSync(join(root, 'CLAUDE.md'), '# Repo\n\n| Situation | Open |\n|---|---|\n| Dev | `docs/plan.md` |\n\nRules in `docs/plan-mode.md`.\n')
  writeFileSync(join(root, 'docs/plan.md'), '# Develop flow\n\nSee `docs/plan-mode.md` and [ui](testing/ui.md).\n')
  writeFileSync(join(root, 'docs/plan-mode.md'), '# Plan\n\n| Came from | Return to |\n|---|---|\n| `docs/plan.md` | `docs/plan.md` |\n| Any other doc | That doc |\n')
  writeFileSync(join(root, 'docs/testing/ui.md'), '# UI\n\nBack to `docs/plan.md`.\n')
  return root
}

test('scan finds nodes, counts edges, resolves relative links, spots return tables', () => {
  const g = scan(fixture())
  assert.equal(g.entry, 'CLAUDE.md')
  assert.deepEqual(g.nodes.map((n) => n.path).sort(), ['CLAUDE.md', 'docs/plan-mode.md', 'docs/plan.md', 'docs/testing/ui.md'])
  assert.deepEqual(g.edges.find((e) => e.from === 'docs/plan.md' && e.to === 'docs/testing/ui.md'), { from: 'docs/plan.md', to: 'docs/testing/ui.md', count: 1 })
  assert.deepEqual(g.returnTables, ['docs/plan-mode.md'])
  assert.equal(g.nodes.find((n) => n.path === 'docs/plan.md').title, 'Develop flow')
})

test('insertRow appends after the last table row', () => {
  assert.equal(insertRow('## X\n\n| a | b |\n|--|--|\n| 1 | 2 |\n\nrest', '| 3 | 4 |').split('\n')[5], '| 3 | 4 |')
  assert.equal(insertRow('no table', '| x |'), null)
})

test('create writes the file and wires parents, links and return rows', () => {
  const root = fixture()
  create(root, { path: 'docs/testing/perf.md', situation: 'Perf check', parents: ['CLAUDE.md', 'docs/plan.md'], links: ['docs/testing/ui.md'], returnRows: ['docs/plan-mode.md'] })
  const claude = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  assert.match(claude, /\| Dev \| `docs\/plan.md` \|\n\| Perf check \| `docs\/testing\/perf.md` \|\n\nRules/)
  assert.match(readFileSync(join(root, 'docs/plan.md'), 'utf8'), /See also `docs\/testing\/perf.md` — Perf check\.\n$/)
  assert.match(readFileSync(join(root, 'docs/plan-mode.md'), 'utf8'), /perf flow\) \|\n\| Any other doc/)
  assert.match(readFileSync(join(root, 'docs/testing/perf.md'), 'utf8'), /^# Perf\n[\s\S]*Related: `docs\/testing\/ui.md`\.\n$/)
  assert.throws(() => create(root, { path: 'docs/testing/perf.md', situation: 'x' }), /already exists/)
  assert.throws(() => create(root, { path: '../evil.md', situation: 'x' }), /path must/)
  assert.throws(() => create(root, { path: 'docs/x.md', situation: 'x', parents: ['../../etc/motd'] }), /not a doc in this graph/)
  assert.equal(scan(root).edges.filter((e) => e.from === 'docs/testing/perf.md').length, 2)
})

test('scan lists references to missing docs and unlink cleans the safe ones', () => {
  const root = fixture()
  writeFileSync(join(root, 'docs/plan.md'), '# Develop flow\n\nSee `docs/plan-mode.md` and [ui](testing/ui.md).\n\nOpen `docs/gone.md` when stuck.\n\nSee also `docs/gone.md` — old.\n\nRelated: `docs/gone.md`, `docs/plan-mode.md`.\n')
  writeFileSync(join(root, 'CLAUDE.md'), '# Repo\n\n| Situation | Open |\n|---|---|\n| Dev | `docs/plan.md` |\n| Old | `docs/gone.md` |\n')
  const g = scan(root)
  assert.deepEqual(g.broken.map((b) => [b.from, b.line, b.fixable]), [['CLAUDE.md', 6, true], ['docs/plan.md', 5, false], ['docs/plan.md', 7, true], ['docs/plan.md', 9, true]])
  assert.equal(unlink(root, 'CLAUDE.md', 'docs/gone.md'), 1)
  assert.equal(unlink(root, 'docs/plan.md', 'docs/gone.md'), 2)
  const plan = readFileSync(join(root, 'docs/plan.md'), 'utf8')
  assert.match(plan, /Open `docs\/gone.md` when stuck/, 'prose is left for a human')
  assert.doesNotMatch(plan, /See also/)
  assert.match(plan, /Related: `docs\/plan-mode.md`\.\n$/)
  assert.doesNotMatch(readFileSync(join(root, 'CLAUDE.md'), 'utf8'), /gone/)
  assert.equal(scan(root).broken.length, 1)
})

test('relink repoints or strips a reference inside prose', () => {
  const root = fixture()
  writeFileSync(join(root, 'docs/plan.md'), '# Plan\n\nAsk which flow (`plan.md` vs `ui.md` vs other). See [the checklist](ui.md) too.\n')
  assert.equal(relink(root, 'docs/plan.md', 'ui.md', 'docs/testing/ui.md'), 2)
  assert.equal(readFileSync(join(root, 'docs/plan.md'), 'utf8'), '# Plan\n\nAsk which flow (`plan.md` vs `docs/testing/ui.md` vs other). See [the checklist](docs/testing/ui.md) too.\n')
  assert.equal(scan(root).broken.length, 0)
  writeFileSync(join(root, 'docs/plan.md'), '# Plan\n\nRead the skill (and its `PICKER.md`). See [picker](PICKER.md).\n')
  assert.equal(relink(root, 'docs/plan.md', 'PICKER.md', ''), 2)
  assert.equal(readFileSync(join(root, 'docs/plan.md'), 'utf8'), '# Plan\n\nRead the skill (and its). See picker.\n')
})

test('unlink and relink can be scoped to one line', () => {
  const root = fixture()
  writeFileSync(join(root, 'docs/plan.md'), '# Plan\n\nSee also `docs/gone.md` — a.\n\nSee also `docs/gone.md` — b.\n\nOpen `docs/gone.md` now, then `docs/gone.md` again.\n')
  assert.equal(unlink(root, 'docs/plan.md', 'docs/gone.md', 5), 1)
  let plan = readFileSync(join(root, 'docs/plan.md'), 'utf8')
  assert.match(plan, /See also `docs\/gone.md` — a\./)
  assert.doesNotMatch(plan, /— b\./)
  assert.equal(relink(root, 'docs/plan.md', 'docs/gone.md', 'docs/plan-mode.md', 5), 2)
  plan = readFileSync(join(root, 'docs/plan.md'), 'utf8')
  assert.match(plan, /Open `docs\/plan-mode.md` now, then `docs\/plan-mode.md` again\./)
  assert.match(plan, /See also `docs\/gone.md` — a\./, 'other lines untouched')
})

test('scan honours the docs folder and the walk prunes node_modules', () => {
  const root = fixture()
  mkdirSync(join(root, 'specs'))
  mkdirSync(join(root, 'node_modules/x'), { recursive: true })
  writeFileSync(join(root, 'specs/a.md'), '# A\n')
  writeFileSync(join(root, 'node_modules/x/README.md'), '# no\n')
  const paths = scan(root, { docs: 'specs' }).nodes.map((n) => n.path)
  assert.deepEqual(paths.slice(0, 2), ['CLAUDE.md', 'specs/a.md'])
  assert.ok(paths.includes('docs/plan.md'), 'docs the entry points at still join the graph')
  assert.ok(!paths.includes('docs/testing/ui.md'), 'docs only reachable through an unscanned doc do not')
  assert.ok(!mdPaths(root).some((p) => p.startsWith('node_modules')))
  assert.ok(mdPaths(root).includes('docs/testing/ui.md'))
})
