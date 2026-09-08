<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ entry: string; docs: string; readOnly?: boolean }>()
const el = ref<HTMLDialogElement | null>(null)
defineExpose({ open: () => el.value?.showModal() })
</script>

<template>
  <dialog
    ref="el"
    class="m-auto w-[min(92vw,640px)] rounded-lg border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-[2px] open:animate-in open:fade-in-0 open:zoom-in-95"
    @click.self="el?.close()"
  >
    <div class="max-h-[80vh] overflow-y-auto px-7 py-6">
      <div class="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 class="font-display text-[28px] leading-none">how signpost works</h2>
          <p class="mt-2 text-[13px] text-muted-foreground">Your agent instructions are a web of small docs pointing at each other. This is that web, drawn.</p>
        </div>
        <button class="rounded-md px-2 py-1 text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground" @click="el?.close()">close</button>
      </div>

      <section class="space-y-5 text-[13.5px] leading-relaxed">
        <div>
          <h3 class="mb-1 text-[11px] font-medium lowercase tracking-wide text-muted-foreground">what is a card</h3>
          <p v-if="readOnly" class="mb-2 rounded-md bg-muted px-3 py-2 text-[12.5px]">This is the web version: the graph is read from a public GitHub repo in your browser and nothing can be written. Install <code class="rounded bg-background px-1">@brotzi/signpost</code> to create and fix docs locally.</p>
          <p>Every markdown file in <code class="rounded bg-muted px-1">{{ docs === '.' ? 'the whole repo' : docs + '/' }}</code>, plus <code class="rounded bg-muted px-1">{{ entry }}</code> (the entry, badged) and any other file they mention. The colored edge is the folder. <span class="text-accent-success">↓</span> counts docs pointing here, <span class="text-accent-orange">↑</span> counts docs this one points to.</p>
        </div>

        <div>
          <h3 class="mb-1 text-[11px] font-medium lowercase tracking-wide text-muted-foreground">how files get bound</h3>
          <p>A link is any path to a <code class="rounded bg-muted px-1">.md</code> file written in a doc, either in backticks or as a markdown link:</p>
          <pre class="mt-2 rounded-md bg-muted px-3 py-2 text-[12px]">Open `docs/plan-mode.md` and apply its rules.
See the [UI checklist](testing/ui.md).</pre>
          <p class="mt-2">Paths resolve from the repo root first, then from the folder of the doc that mentions them. An arrow points from the doc that mentions to the doc mentioned. A number on an arrow is how many times. Nothing else is needed: write the path and the graph updates on <strong>rescan</strong>.</p>
        </div>

        <div>
          <h3 class="mb-1 text-[11px] font-medium lowercase tracking-wide text-muted-foreground">creating a doc</h3>
          <p><strong>new doc</strong> opens a form. Each field is one concrete edit, so the new file is wired in the moment it exists:</p>
          <ul class="mt-2 list-disc space-y-1 pl-5">
            <li><strong>path</strong> · where the file goes, like <code class="rounded bg-muted px-1">{{ docs }}/testing/perf.md</code>. Existing files are never overwritten.</li>
            <li><strong>situation</strong> · one line saying when an agent should open it. It becomes a row in the first table of <code class="rounded bg-muted px-1">{{ entry }}</code>.</li>
            <li><strong>link from</strong> · which docs should point at the new one. The entry gets the table row; any other parent gets a <em>See also</em> line.</li>
            <li><strong>links to</strong> · which docs the new one should point at. Written as a <em>Related</em> line at its end.</li>
            <li><strong>return row</strong> · for docs with a <em>Came from / Return to</em> table, adds the row that sends the agent back here.</li>
            <li><strong>body</strong> · paste, drop a <code class="rounded bg-muted px-1">.md</code>, or leave empty for a template that names the caller.</li>
          </ul>
        </div>

        <div>
          <h3 class="mb-1 text-[11px] font-medium lowercase tracking-wide text-muted-foreground">worked example</h3>
          <p>Nothing is written until you press <strong>create doc</strong>. Say you fill the form with:</p>
          <ul class="mt-2 list-disc space-y-0.5 pl-5">
            <li><strong>path</strong> <code class="rounded bg-muted px-1">{{ docs }}/testing/perf.md</code></li>
            <li><strong>situation</strong> <em>Performance regression check</em></li>
            <li><strong>link from</strong> <code class="rounded bg-muted px-1">{{ entry }}</code> and <code class="rounded bg-muted px-1">{{ docs }}/plan.md</code></li>
            <li><strong>links to</strong> <code class="rounded bg-muted px-1">{{ docs }}/testing/ui.md</code></li>
            <li><strong>body</strong> empty</li>
          </ul>
          <p class="mt-3">Four edits happen. The new file, from the template plus your <em>links to</em>:</p>
          <pre class="mt-1 rounded-md bg-muted px-3 py-2 text-[12px]"># Perf

Performance regression check

Entered from `{{ entry }}`. When finished, return to `{{ entry }}`.

Related: `{{ docs }}/testing/ui.md`.</pre>
          <p class="mt-3">One row appended to the first table in <code class="rounded bg-muted px-1">{{ entry }}</code>:</p>
          <pre class="mt-1 rounded-md bg-muted px-3 py-2 text-[12px]">| Performance regression check | `{{ docs }}/testing/perf.md` |</pre>
          <p class="mt-3">One line at the end of <code class="rounded bg-muted px-1">{{ docs }}/plan.md</code>, the other parent:</p>
          <pre class="mt-1 rounded-md bg-muted px-3 py-2 text-[12px]">See also `{{ docs }}/testing/perf.md` — Performance regression check.</pre>
          <p class="mt-3">And if you ticked a <em>return row</em>, one row in that doc's <em>Came from / Return to</em> table:</p>
          <pre class="mt-1 rounded-md bg-muted px-3 py-2 text-[12px]">| `{{ docs }}/testing/perf.md` | `{{ docs }}/testing/perf.md` (continue perf flow) |</pre>
          <p class="mt-3">In the graph: a new card with two arrows in, from <code class="rounded bg-muted px-1">{{ entry }}</code> and <code class="rounded bg-muted px-1">plan.md</code>, and one arrow out, to <code class="rounded bg-muted px-1">ui.md</code>. If you paste or drop your own body, only the <em>Related</em> line is appended to it.</p>
        </div>

        <div>
          <h3 class="mb-1 text-[11px] font-medium lowercase tracking-wide text-muted-foreground">reading and moving around</h3>
          <ul class="list-disc space-y-1 pl-5">
            <li>Click a card to read it. Paths inside the text are clickable and jump to that card.</li>
            <li>The folder name in the header opens a picker with every folder that holds markdown. Pick one to scope the graph or to match a repo with another layout; the choice lands in the URL as <code class="rounded bg-muted px-1">?docs=</code>.</li>
            <li>Drag cards anywhere. <strong>reorder</strong> puts them back: ranked left to right by distance from the entry, grouped by folder.</li>
            <li>On dense graphs, arrows are drawn only for the card under the cursor or the selected one. Hover to explore.</li>
            <li>Scroll to zoom, drag the background to pan, the corner buttons refit.</li>
            <li>When a doc is deleted or renamed, <strong>rescan</strong> lists every reference to it as a <em>broken link</em> in the header. Table rows, <em>See also</em> and <em>Related</em> entries can be removed with one click; references inside prose are shown for you to edit.</li>
          </ul>
        </div>
      </section>
    </div>
  </dialog>
</template>
