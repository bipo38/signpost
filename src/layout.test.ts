import { test } from 'node:test'
import assert from 'node:assert/strict'
import { NODE_H, NODE_W, place } from './layout.ts'

test('ranks by distance from the entry, parks unreachable docs last, wraps tall ranks', () => {
  const nodes = ['CLAUDE.md', 'docs/a.md', 'docs/b.md', 'docs/c.md', 'lost.md', ...Array.from({ length: 20 }, (_, i) => `docs/many/${i}.md`)]
  const edges = [
    { from: 'CLAUDE.md', to: 'docs/a.md' }, { from: 'CLAUDE.md', to: 'docs/b.md' },
    { from: 'docs/a.md', to: 'docs/c.md' }, { from: 'docs/c.md', to: 'CLAUDE.md' },
    ...Array.from({ length: 20 }, (_, i) => ({ from: 'docs/b.md', to: `docs/many/${i}.md` })),
  ]
  const at = new Map(place(nodes, edges, 'CLAUDE.md').map((p) => [p.id, p]))
  assert.equal(at.get('CLAUDE.md')!.x, 0)
  assert.equal(at.get('docs/a.md')!.x, at.get('docs/b.md')!.x)
  assert.ok(at.get('docs/c.md')!.x > at.get('docs/a.md')!.x)
  assert.ok(at.get('lost.md')!.x > at.get('docs/c.md')!.x, 'unreachable docs sit in the last rank')
  const many = nodes.filter((n) => n.startsWith('docs/many/')).map((n) => at.get(n)!)
  assert.equal(new Set(many.map((p) => p.x)).size, 2, '20 docs wrap into two columns')
  assert.equal(new Set(many.map((p) => `${p.x},${p.y}`)).size, 20, 'no two cards share a spot')
  assert.ok(many.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y)))
  // c shares the rank with the 20 and sorts by folder, so it heads the first column above every docs/many card there.
  const c = at.get('docs/c.md')!
  assert.ok(many.filter((p) => p.x === c.x).every((p) => p.y > c.y))
  assert.ok(many.every((p) => p.x >= c.x))
  void NODE_W; void NODE_H
})
