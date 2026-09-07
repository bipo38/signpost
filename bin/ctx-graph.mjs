#!/usr/bin/env node
import { parseArgs } from 'node:util'
import { resolve } from 'node:path'
import { serve } from '../server/index.mjs'

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: process.cwd() },
    docs: { type: 'string', default: 'docs' },
    port: { type: 'string', default: '4747' },
    open: { type: 'boolean', default: true },
    help: { type: 'boolean', short: 'h' },
  },
  allowNegative: true,
})
if (values.help) {
  console.log(`ctx-graph [--root .] [--docs docs] [--port 4747] [--no-open]

Serves a graph of the context-pointer docs behind CLAUDE.md / AGENTS.md in --root,
and a form to add new docs wired into them.`)
  process.exit(0)
}
serve({ root: resolve(values.root), docs: values.docs, port: Number(values.port), open: values.open })
