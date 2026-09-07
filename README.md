# Signpost

Visualize the context-pointer docs behind a `CLAUDE.md` / `AGENTS.md` file as a graph, and add new docs already wired into it.

![Signpost in light mode showing a docs graph with plan.md selected](docs/screenshot.jpg)

Landing page and live demo: https://bipo38.github.io/signpost/

Agent instruction files tend to grow into a web of small markdown docs that point at each other: "for a bug, open `docs/plan.md`; when testing, open `docs/testing/ui.md`; after planning, return to the caller". Signpost draws that web, lets you read every doc in place, and adds new ones with the table rows and back-links already written.

- Framework agnostic. It only reads markdown, so it works in any repo.
- Zero runtime dependencies. One Node process, UI prebuilt. Requires Node 20+.
- Local only. The server binds to `127.0.0.1` and never leaves your machine.

## Install

```sh
npx @brotzi/signpost            # one-off, from the repo root
```

Or add it to a project and give it a script:

```sh
pnpm add -D @brotzi/signpost    # or npm i -D / yarn add -D
```

```json
"scripts": { "docs:graph": "signpost" }
```

Requires Node 20 or newer. Nothing else: the UI ships prebuilt and the server has no dependencies.

## Run

```sh
signpost                      # scans ./CLAUDE.md and ./docs, opens http://localhost:4747
signpost --root ../other --docs documentation --port 5000 --no-open
signpost --help
```

| Flag | Default | Meaning |
|------|---------|---------|
| `--root` | cwd | Repo to scan. Files are read and written relative to it. |
| `--docs` | `docs` | Folder whose `*.md` files become nodes. `guide/` and `node_modules/` are skipped. |
| `--port` | `4747` | Port on localhost. |
| `--no-open` | | Do not open the browser. |

## What it reads

- **Entry.** `CLAUDE.md`, else `AGENTS.md`, in `--root`.
- **Nodes.** The entry file, every `*.md` under `--docs`, and any other markdown file they reference (for example a `PRODUCT.md` at the root).
- **Edges.** Backticked paths like `` `docs/plan.md` `` and markdown links like `[ui](testing/ui.md)`, resolved from the root and then from the referencing file's folder. An arrow goes from the doc that references to the doc it references. A number on an edge is the reference count.

Nothing is written until you press **create doc**.

## Using the graph

- **Read.** Click a card to render the doc on the right, under a small diagram of what points at it and what it points to. Every dot and name there, and every backticked path in the text, jumps to that card.
- **Arrange.** Cards are ranked left to right by link distance from the entry doc, clustered by folder, and tinted per folder. Drag them freely. **reorder** puts them back and refits the view. **rescan** re-reads the files after you edit them outside the tool.
- **Dense graphs.** Above 250 links, edges are drawn only for the hovered or selected doc, so a few hundred docs stay readable and load instantly.
- **Panel.** The icon at the far right of the header hides or shows the side panel. Selecting a card or pressing **new doc** opens it again.
- **Theme.** **light** / **dark** follows your system by default and remembers your choice in the browser.

## Creating a doc

**new doc** opens a form. Every field maps to a concrete edit:

| Field | What happens |
|-------|--------------|
| **path** | Where the file goes, relative to the root. Must be `folder/name.md`, no `..`. Defaults to `<docs>/<uploaded name>` when you drop a file. |
| **situation** | Becomes a row in the entry file's first table: `` | situation | `path` | ``. |
| **link from** | Collapsed list with a filter. The entry file gets that table row. Any other parent gets a `See also \`path\` — situation.` line appended. |
| **links to** | Appended to the new doc as `Related: \`a\`, \`b\`.` so its outgoing edges show up immediately. |
| **return row** | Offered for any doc with a `| Came from | Return to |` table. Adds a row above the `Any other doc` fallback, or at the end of the table. |
| **body** | Paste, drop a `.md`, or upload. Empty means a template naming the caller and the plan-mode pointer. |

Only docs already in the graph can be picked as parents, links, or return tables. Existing files are never overwritten.

## Develop

```sh
git clone https://github.com/bipo38/signpost.git && cd signpost
pnpm install          # also builds dist/
pnpm dev:api          # API on :4747 against ../olaaaaaaa/comsart (edit the script for your repo)
pnpm dev              # Vite UI on :5173, proxies /api
pnpm test             # node:test on server/graph.mjs
pnpm build            # dist/ served by the bin
```

## License

MIT
