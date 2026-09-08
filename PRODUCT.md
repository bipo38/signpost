# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Register

product

## Users

Developers who keep agent instruction files (`CLAUDE.md`, `AGENTS.md`) in their repos, plus the small markdown docs those files point to. They open Signpost from the repo root, at their desk, usually while writing or reorganising docs. The job: see how the docs link together, read one in place, add a new one that is already wired in, and repair references that point at deleted files.

The landing page in `site/` has a second audience: a colleague or stranger deciding in under a minute whether to run `npx @brotzi/signpost`. Work on that surface in the brand register.

## Product Purpose

Draw the graph of context-pointer docs behind an entry file so nobody has to hold it in their head. Read any doc without leaving the graph. Create docs with the table rows and back-links already written, so new docs are linked from day one. List broken pointers and fix each one with one click. Success: a repo with hundreds of specs stays navigable, and every doc is reachable from the entry file.

## Brand Personality

Technical, dense, fast. Information first, chrome last. Copy is lowercase, short, and literal: buttons say what they write. Every write is previewed before it happens and nothing is ever overwritten. The tool should feel like a good terminal utility with a graph attached, not like a product with a graph feature.

## Anti-references

- Generic SaaS marketing: hero metric, gradient text, icon-heading-text card grids, uppercase eyebrows on every section.
- Diagramming tools that make the canvas the hero and bury the content. The docs are the point; the graph is the index.
- Dashboards that hide what they will change behind a spinner. Signpost shows the diff, then writes.

## Design Principles

- **Show the write before the write.** Every field, button, and fix maps to one visible edit. Diffs over descriptions.
- **Dense by default.** Small type, tight cards, hundreds of docs on one screen. Whitespace is for reading, not for decoration.
- **The graph is a table of contents.** Selection, hover, and colour exist to get you to the doc, not to admire the layout.
- **Local, boring, fast.** One process, no runtime dependencies, instant layout. Speed is part of the personality.
- **Practice what it preaches.** The landing page should demonstrate the tool, not describe it.

## Accessibility & Inclusion

WCAG AA as the floor: 4.5:1 body contrast, keyboard reachable controls, visible focus. Reduced motion is honoured everywhere: edge drawing, card entrances, and fan animations collapse to instant. Colour never carries meaning alone: inbound and outbound counts also use arrows, broken links also use strikethrough and a minus row. Touch targets on the landing page are at least 44px on coarse pointers.
