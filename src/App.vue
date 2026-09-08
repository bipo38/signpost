<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { VueFlow, useVueFlow, type Edge as FlowEdge, type Node as FlowNode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { marked } from 'marked'
import { api, readOnly, repo, setDocs, type Graph } from './api'
import { DENSE_EDGES, NODE_H, NODE_W, toFlow } from './layout'
import DocNode from './components/DocNode.vue'
import NewDocForm from './components/NewDocForm.vue'
import InfoDialog from './components/InfoDialog.vue'
import LinkedDocs from './components/LinkedDocs.vue'
import FolderPicker from './components/FolderPicker.vue'

const graph = ref<Graph | null>(null)
const nodes = shallowRef<FlowNode[]>([])
const edges = shallowRef<FlowEdge[]>([])
const selected = ref<string | null>(null)
const content = ref('')
const mode = ref<'view' | 'create' | 'broken'>('view')
const SHOW_BROKEN = true
const hovered = ref<string | null>(null)
// Dense graphs draw only the edges touching the selected or hovered doc; everything else would be a wall of lines.
const dense = computed(() => (graph.value?.edges.length ?? 0) > DENSE_EDGES)
const panelOpen = ref(true)
// Fit everything, but never below MIN_ZOOM: a long chain in a narrow window would be unreadable,
// so in that case anchor the left end (the entry doc) and let the user pan.
const MIN_ZOOM = 0.6
const MAX_FIT_ZOOM = 1
// Viewport is computed from the known card positions rather than fitView: with only visible
// elements rendered, Vue Flow has nothing measured to fit on first paint.
function fit() {
  const { width, height } = dimensions.value
  if (!nodes.value.length || !width) return
  const xs = nodes.value.map((n) => n.position.x)
  const ys = nodes.value.map((n) => n.position.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const graphW = Math.max(...xs) + NODE_W - minX
  const graphH = Math.max(...ys) + NODE_H - minY
  const fitZoom = Math.min(width / graphW, height / graphH) * 0.94
  // Small graph that would fit only when tiny: floor the zoom and anchor the entry doc on the left instead.
  const anchorLeft = fitZoom < MIN_ZOOM && nodes.value.length <= 30 && graphH * MIN_ZOOM <= height
  const zoom = anchorLeft ? MIN_ZOOM : Math.min(fitZoom, MAX_FIT_ZOOM)
  const x = anchorLeft ? 24 - minX * zoom : (width - graphW * zoom) / 2 - minX * zoom
  setViewport({ x, y: (height - graphH * zoom) / 2 - minY * zoom, zoom }, { duration: 300 })
}
function togglePanel(open = !panelOpen.value) {
  panelOpen.value = open
  nextTick(fit)
}
const loadError = ref('')
const loading = ref(false)
const { setViewport, dimensions } = useVueFlow()

// Recompute the dagre layout from the current graph and fit it into view.
function reorder() {
  if (!graph.value) return
  const f = toFlow(graph.value)
  nodes.value = f.nodes
  edges.value = f.edges
  highlight()
  requestAnimationFrame(fit)
  // ponytail: a graph that arrives seconds after mount (GitHub mode) sometimes misses the first fit; one retry covers it.
  setTimeout(fit, 400)
}

async function load(focus?: string) {
  loading.value = true
  try {
    graph.value = await api.graph()
    loadError.value = ''
    if (focus) select(focus)
    if (mode.value === 'broken' && !graph.value.broken.length) mode.value = 'view'
    reorder()
  } catch (e) {
    loadError.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const picker = ref<InstanceType<typeof FolderPicker> | null>(null)
function pickDocs(d: string) {
  setDocs(d)
  selected.value = null
  mode.value = 'view'
  load()
}

async function select(path: string) {
  selected.value = path
  mode.value = 'view'
  panelOpen.value = true
  content.value = (await api.file(path)).content
}

// Highlight the edges touching the selected node; dim the rest.
function highlight() {
  const s = selected.value
  const h = hovered.value
  for (const e of edges.value) {
    const touchesSel = !!s && (e.source === s || e.target === s)
    const touchesHov = !!h && (e.source === h || e.target === h)
    e.class = touchesSel ? 'lit' : s ? 'dim' : ''
    if (dense.value) e.hidden = !touchesSel && !touchesHov
  }
  edges.value = [...edges.value]
}
watch([selected, hovered], highlight)

const nodeSet = computed(() => new Set(graph.value?.nodes.map((n) => n.path)))
const html = computed(() => {
  const raw = marked.parse(content.value, { async: false }) as string
  // Backticked paths that are graph nodes become in-app links.
  return raw.replace(/<code>([\w./-]+\.md)<\/code>/g, (m, p) =>
    nodeSet.value.has(p) ? `<a class="doc-link" data-path="${p}"><code>${p}</code></a>` : m,
  )
})
function onProseClick(e: MouseEvent) {
  const a = (e.target as HTMLElement).closest<HTMLElement>('a.doc-link')
  if (a?.dataset.path) select(a.dataset.path)
}

const dark = ref(false)
function setDark(v: boolean) {
  dark.value = v
  document.documentElement.classList.toggle('dark', v)
  try { localStorage.setItem('signpost:dark', String(v)) } catch {}
}
onMounted(() => {
  let stored: string | null = null
  try { stored = localStorage.getItem('signpost:dark') } catch {}
  setDark(stored ? stored === 'true' : matchMedia('(prefers-color-scheme: dark)').matches)
  load()
})

const rootName = computed(() => graph.value?.root.split('/').pop())

async function unlink(b: { from: string; ref: string; fixable: boolean; line: number }) {
  // Only this line: table rows and "See also" lines are dropped whole; in prose only the reference is stripped.
  await (b.fixable ? api.unlink(b.from, b.ref, b.line) : api.relink(b.from, b.ref, '', b.line))
  await load()
  if (graph.value?.broken.length) mode.value = 'broken'
}
const fixTarget = ref<Record<string, string>>({})
const fixKey = (b: { from: string; line: number; ref: string }) => `${b.from}:${b.line}:${b.ref}`
// Best guess for a replacement: a doc with the same file name.
function suggest(ref: string) {
  const name = ref.split('/').pop()
  return graph.value?.nodes.find((n) => n.path.split('/').pop() === name)?.path ?? ''
}
// Diff preview for a broken line: just the text around the reference, so a long table row or
// paragraph reads as one change instead of a wall of markdown.
const CTX = 14
function diffOf(b: { text: string; ref: string; fixable: boolean; line: number; from: string }) {
  const i = b.text.indexOf(b.ref)
  let pre = i < 0 ? '' : b.text.slice(0, i)
  let post = i < 0 ? b.text : b.text.slice(i + b.ref.length)
  if (pre.length > CTX) pre = '…' + pre.slice(-CTX)
  if (post.length > CTX) post = post.slice(0, CTX) + '…'
  const to = fixTarget.value[fixKey(b)] ?? suggest(b.ref)
  // Stripping a backticked path in prose takes its backticks with it, as the server does.
  const strip = !to && pre.endsWith('`') && post.startsWith('`')
  return { pre, post, to, removes: !to && b.fixable, pre2: strip ? pre.slice(0, -1) : pre, post2: strip ? post.slice(1) : post }
}
async function relink(b: { from: string; ref: string; line: number }) {
  const to = fixTarget.value[fixKey(b)] ?? suggest(b.ref)
  if (!to) return
  await api.relink(b.from, b.ref, to, b.line)
  await load()
  if (graph.value?.broken.length) mode.value = 'broken'
}
const info = ref<InstanceType<typeof InfoDialog> | null>(null)
</script>

<template>
  <div class="grid h-full grid-rows-[auto_1fr]">
    <!-- Narrow windows: the stats truncate before anything wraps; below 640px they drop to their own row under the actions. -->
    <header class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b px-5 py-3">
      <div class="flex min-w-0 flex-1 items-center gap-3 max-sm:order-none">
        <h1 class="shrink-0 font-display text-[22px] leading-none">signpost</h1>
        <span v-if="graph" class="flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground max-sm:hidden">
          <span class="truncate"><span class="text-foreground">{{ rootName }}</span> · {{ graph.entry }} · <button class="rounded-sm px-1 text-foreground hover:bg-accent" title="Change the scanned folder" @click="picker?.open()">{{ graph.docs === '.' ? 'whole repo' : graph.docs }} ▾</button> · {{ graph.nodes.length }} docs · {{ graph.edges.length }} links</span>
          <span v-if="dense" class="shrink-0 rounded-sm bg-muted px-1.5 py-px text-[11px] max-lg:hidden">dense · links shown for the hovered or selected doc</span>
          <button v-if="SHOW_BROKEN && graph.broken.length" class="shrink-0 whitespace-nowrap rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-px text-[11px] text-destructive hover:bg-destructive/20" @click="mode = 'broken'; selected = null; panelOpen = true">
            {{ graph.broken.length }} broken {{ graph.broken.length === 1 ? 'link' : 'links' }}
          </button>
        </span>
      </div>
      <div class="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
        <button class="h-8 w-8 rounded-md text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="How it works" @click="info?.open()">?</button>
        <button v-if="!readOnly" class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="load(selected ?? undefined)">rescan</button>
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="Reset positions to the automatic layout" @click="reorder">reorder</button>
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" :aria-pressed="dark" @click="setDark(!dark)">{{ dark ? 'light' : 'dark' }}</button>
        <button v-if="!readOnly" class="ml-1 h-8 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-primary/90" @click="mode = 'create'; selected = null; panelOpen = true">new doc</button>
        <button class="h-8 w-8 rounded-md text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" :title="panelOpen ? 'Hide panel' : 'Show panel'" :aria-pressed="panelOpen" @click="togglePanel()">
          <svg viewBox="0 0 16 16" class="mx-auto size-4" fill="none" stroke="currentColor" stroke-width="1.25"><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M10 2.5v11" /><path v-if="panelOpen" d="M10 8h4.5" class="stroke-accent-orange" stroke-width="2" /></svg>
        </button>
      </div>
      <span v-if="graph" class="hidden w-full min-w-0 items-center gap-2 text-[12px] text-muted-foreground max-sm:flex">
        <span class="truncate"><span class="text-foreground">{{ rootName }}</span> · <button class="rounded-sm px-1 text-foreground hover:bg-accent" @click="picker?.open()">{{ graph.docs === '.' ? 'whole repo' : graph.docs }} ▾</button> · {{ graph.nodes.length }} docs · {{ graph.edges.length }} links</span>
        <button v-if="SHOW_BROKEN && graph.broken.length" class="ml-auto shrink-0 whitespace-nowrap rounded-sm border border-destructive/40 bg-destructive/10 px-1.5 py-px text-[11px] text-destructive hover:bg-destructive/20" @click="mode = 'broken'; selected = null; panelOpen = true">
          {{ graph.broken.length }} broken
        </button>
      </span>
    </header>
    <InfoDialog v-if="graph" ref="info" :entry="graph.entry" :docs="graph.docs" :read-only="readOnly" />
    <FolderPicker v-if="graph" ref="picker" :current="graph.docs" @pick="pickDocs" />

    <div class="grid min-h-0" :class="panelOpen ? 'grid-cols-[1fr_360px]' : 'grid-cols-[1fr]'">
      <div class="relative min-h-0">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :min-zoom="0.05"
          :max-zoom="2"
          :nodes-draggable="true"
          :nodes-connectable="false"
          :elements-selectable="true"
          only-render-visible-elements
          @pane-ready="fit"
          @node-click="select($event.node.id)"
          @node-mouse-enter="hovered = $event.node.id"
          @node-mouse-leave="hovered = null"
          @pane-click="selected = null"
        >
          <template #node-doc="p"><DocNode :data="p.data" :selected="p.id === selected" /></template>
          <Background pattern-color="var(--dot)" :gap="22" :size="1.2" />
          <Controls :show-interactive="false" position="bottom-left" />
        </VueFlow>
        <p v-if="loadError" class="absolute inset-x-0 top-4 mx-auto w-max rounded-md border border-destructive/40 bg-card px-3 py-2 text-[12.5px] text-destructive">{{ loadError }}</p>
      </div>

      <aside v-if="panelOpen" class="min-h-0 overflow-y-auto border-l bg-card/60 px-6 py-5">
        <template v-if="mode === 'create' && graph && !readOnly">
          <h2 class="mb-4 font-display text-[24px] leading-none">new doc</h2>
          <NewDocForm :graph="graph" @created="load($event)" @cancel="mode = 'view'" />
        </template>
        <template v-else-if="mode === 'broken' && graph">
          <div class="mb-4 flex items-center justify-between gap-2">
            <h2 class="font-display text-[24px] leading-none">broken links</h2>
            <button class="text-[11px] text-muted-foreground hover:text-foreground" @click="mode = 'view'">close</button>
          </div>
          <p v-if="readOnly" class="mb-4 text-[12.5px] text-muted-foreground">References to docs that no longer exist. Fixing them needs the local tool, which can write to the repo.</p>
          <p v-else class="mb-4 text-[12.5px] text-muted-foreground">References to docs that no longer exist. <strong>replace</strong> points the reference at another doc. <strong>remove</strong> drops a table row or "See also" line, and in prose strips just the reference.</p>
          <ul class="space-y-3">
            <li v-for="b in graph.broken" :key="fixKey(b)" class="rounded-md border bg-card px-3 py-2.5 text-[12.5px]">
              <div class="flex items-center justify-between gap-2">
                <button class="truncate text-left font-medium hover:underline underline-offset-3" @click="select(b.from)">{{ b.from }}<span class="font-normal text-muted-foreground">:{{ b.line }}</span></button>
                <span class="shrink-0 text-[11px] text-muted-foreground">{{ b.fixable ? 'table / list' : 'prose' }}</span>
              </div>
              <div class="mt-1.5 rounded bg-muted px-2 py-1 font-mono text-[11px] leading-5">
                <div class="flex gap-1.5 overflow-hidden whitespace-pre text-muted-foreground">
                  <span class="select-none text-destructive">−</span>
                  <span class="truncate">{{ diffOf(b).pre }}<mark class="rounded-sm bg-destructive/15 px-0.5 text-destructive line-through decoration-destructive/60">{{ b.ref }}</mark>{{ diffOf(b).post }}</span>
                </div>
                <div class="flex gap-1.5 overflow-hidden whitespace-pre text-muted-foreground">
                  <span class="select-none text-accent-success">+</span>
                  <span v-if="diffOf(b).removes" class="italic">line removed</span>
                  <span v-else class="truncate">{{ diffOf(b).pre2 }}<mark v-if="diffOf(b).to" class="rounded-sm bg-accent-success/15 px-0.5 text-accent-success">{{ diffOf(b).to }}</mark>{{ diffOf(b).post2 }}</span>
                </div>
              </div>
              <div v-if="!readOnly" class="mt-2 flex items-center gap-1.5">
                <select :value="fixTarget[fixKey(b)] ?? suggest(b.ref)" class="h-7 min-w-0 flex-1 rounded-md border bg-card px-1.5 text-[11.5px] outline-none focus-visible:border-ring" @change="fixTarget[fixKey(b)] = ($event.target as HTMLSelectElement).value">
                  <option value="" disabled>replace with…</option>
                  <option v-for="n in graph.nodes" :key="n.path" :value="n.path">{{ n.path }}</option>
                </select>
                <button class="h-7 shrink-0 rounded-md bg-primary px-2.5 text-[11.5px] font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" :disabled="!(fixTarget[fixKey(b)] ?? suggest(b.ref))" @click="relink(b)">replace</button>
                <button class="h-7 shrink-0 rounded-md border px-2.5 text-[11.5px] text-destructive hover:bg-destructive/10" @click="unlink(b)">remove</button>
              </div>
            </li>
          </ul>
        </template>
        <template v-else-if="selected">
          <div class="mb-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <code class="truncate">{{ selected }}</code>
            <button class="shrink-0 hover:text-foreground" @click="selected = null">close</button>
          </div>
          <LinkedDocs v-if="graph" :key="selected" :graph="graph" :path="selected" @go="select" />
          <article class="prose-doc" @click="onProseClick" v-html="html" />
        </template>
        <div v-else-if="loading && !graph" class="flex h-full flex-col justify-center gap-2 text-center text-[13px] text-muted-foreground">
          <p class="font-display text-[22px] text-foreground">reading {{ repo ?? 'the repo' }}…</p>
          <p v-if="repo">fetching the file listing and the docs from GitHub.</p>
        </div>
        <div v-else class="flex h-full flex-col justify-center gap-2 text-center text-[13px] text-muted-foreground">
          <p class="font-display text-[22px] text-foreground">nothing selected</p>
          <p>click a doc to read it, or drag them around.<br />arrows point from the doc that references to the doc it references.</p>
        </div>
      </aside>
    </div>
  </div>
</template>
