# ctx-graph

Visualize the context-pointer docs behind a `CLAUDE.md` / `AGENTS.md` file as a graph, and add new docs already wired into it.

Framework agnostic: it only reads markdown. Zero runtime dependencies; the UI ships prebuilt.

## Run

```sh
npx ctx-graph                 # from a repo root; opens http://localhost:4747
ctx-graph --root ../other --docs documentation --port 5000 --no-open
```

Or add it to a project:

```sh
pnpm add -D ctx-graph
# package.json → "docs:graph": "ctx-graph"
```

## What it reads

- Entry: `CLAUDE.md`, else `AGENTS.md`.
- Every `*.md` under `--docs` (default `docs/`), skipping `guide/` and `node_modules/`.
- Links: backticked paths (`` `docs/plan.md` ``) and markdown links (`[x](testing/ui.md)`), resolved from the repo root, then from the referencing file. Arrows point from the doc that references to the doc it references; a label is the reference count.

## Creating a doc

- **path** — where the file goes. Defaults to `docs/<uploaded name>` when you drop a file.
- **situation** — becomes a row in the entry file's first table (`| situation | \`path\` |`).
- **link from** — the entry file gets the table row; any other parent gets a `See also` line.
- **links to** — appended to the new doc as a `Related:` line.
- **return row** — offered for any doc with a `| Came from | Return to |` table.
- **body** — paste, drop a `.md`, or leave empty for a template naming the caller.

## Develop

```sh
pnpm install
pnpm dev:api    # API against ../olaaaaaaa/comsart on :4747
pnpm dev        # Vite UI on :5173, proxies /api
pnpm test       # node:test on server/graph.mjs
pnpm build      # dist/ served by the bin
```
