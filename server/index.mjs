import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'
import { exec } from 'node:child_process'
import { create, mdPaths, relink, scan, unlink } from './graph.mjs'
import { foldersOf } from '../shared/scan.mjs'

const DIST = join(import.meta.dirname, '..', 'dist')
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }

// A docs folder from the query: relative, no empty or `..` segments. It only filters a list walked from root.
const DOCS_OK = /^(\.|[\w.-]+(\/[\w.-]+)*)\/?$/

export function serve({ root, docs, port, open }) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x')
    const json = (code, body) => res.writeHead(code, { 'content-type': 'application/json' }).end(JSON.stringify(body))
    try {
      // The UI may switch the scanned folder per request (?docs=); --docs is only the default.
      const d = url.searchParams.get('docs')
      if (d !== null && (!DOCS_OK.test(d) || d.split('/').includes('..'))) return json(400, { error: 'bad docs folder' })
      const opts = { docs: d ?? docs }
      if (url.pathname === '/api/folders') return json(200, foldersOf(mdPaths(root)))
      if (url.pathname === '/api/graph') return json(200, scan(root, opts))
      if (url.pathname === '/api/file') {
        const p = url.searchParams.get('p')
        if (!scan(root, opts).nodes.some((n) => n.path === p)) return json(404, { error: 'unknown file' })
        return json(200, { path: p, content: readFileSync(join(root, p), 'utf8') })
      }
      if (url.pathname === '/api/create' && req.method === 'POST') {
        const f = await new Response(req, { headers: { 'content-type': req.headers['content-type'] } }).formData()
        const file = f.get('file')
        const uploaded = file?.size ? await file.text() : ''
        const path = create(root, {
          path: f.get('path') || (file?.size ? `${opts.docs}/${file.name}` : ''),
          situation: f.get('situation'),
          body: uploaded || f.get('body'),
          parents: f.getAll('parents'),
          links: f.getAll('links'),
          returnRows: f.getAll('returnRows'),
        }, opts)
        return json(201, { path })
      }
      if (url.pathname === '/api/relink' && req.method === 'POST') {
        const { from, ref, to, line } = JSON.parse(await new Response(req).text())
        const g = scan(root, opts)
        if (!g.nodes.some((n) => n.path === from)) return json(404, { error: 'unknown file' })
        if (to && !g.nodes.some((n) => n.path === to)) return json(400, { error: `${to} is not a doc in this graph` })
        return json(200, { changed: relink(root, from, ref, to, line) })
      }
      if (url.pathname === '/api/unlink' && req.method === 'POST') {
        const { from, ref, line } = JSON.parse(await new Response(req).text())
        if (!scan(root, opts).nodes.some((n) => n.path === from)) return json(404, { error: 'unknown file' })
        return json(200, { removed: unlink(root, from, ref, line) })
      }
      // Static UI from dist, SPA fallback to index.html.
      let file = join(DIST, normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''))
      if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html')
      if (!existsSync(file)) return res.writeHead(500).end('dist/ missing — run pnpm build')
      res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
      createReadStream(file).pipe(res)
    } catch (e) {
      json(400, { error: e.message })
    }
  })
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `port ${port} is in use — pass --port <other>` : e.message)
    process.exit(1)
  })
  // Local tool that writes into your repo: never expose it beyond this machine.
  server.listen(port, '127.0.0.1', () => {
    const addr = `http://localhost:${port}`
    console.log(`signpost → ${addr}  (root: ${root})`)
    if (open) exec(`${process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'} ${addr}`)
  })
  return server
}
