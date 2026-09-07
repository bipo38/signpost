<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue'
import { VueFlow, useVueFlow, type Edge as FlowEdge, type Node as FlowNode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { marked } from 'marked'
import { api, type Graph } from './api'
import { DENSE_EDGES, NODE_H, NODE_W, toFlow } from './layout'
import DocNode from './components/DocNode.vue'
import NewDocForm from './components/NewDocForm.vue'
import InfoDialog from './components/InfoDialog.vue'

const graph = ref<Graph | null>(null)
const nodes = shallowRef<FlowNode[]>([])
const edges = shallowRef<FlowEdge[]>([])
const selected = ref<string | null>(null)
const content = ref('')
const mode = ref<'view' | 'create'>('view')
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
const { setViewport, dimensions } = useVueFlow()

// Recompute the dagre layout from the current graph and fit it into view.
function reorder() {
  if (!graph.value) return
  const f = toFlow(graph.value)
  nodes.value = f.nodes
  edges.value = f.edges
  highlight()
  requestAnimationFrame(fit)
}

async function load(focus?: string) {
  try {
    graph.value = await api.graph()
    loadError.value = ''
    if (focus) select(focus)
    reorder()
  } catch (e) {
    loadError.value = (e as Error).message
  }
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
const info = ref<InstanceType<typeof InfoDialog> | null>(null)
</script>

<template>
  <div class="grid h-full grid-rows-[auto_1fr]">
    <header class="flex items-center justify-between border-b px-5 py-3">
      <div class="flex items-baseline gap-3">
        <h1 class="font-display text-[22px] leading-none">signpost</h1>
        <span v-if="graph" class="text-[12.5px] text-muted-foreground">
          <span class="text-foreground">{{ rootName }}</span> · {{ graph.entry }} · {{ graph.nodes.length }} docs · {{ graph.edges.length }} links
          <span v-if="dense" class="ml-2 rounded-sm bg-muted px-1.5 py-px text-[11px]">dense · links shown for the hovered or selected doc</span>
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <button class="h-8 w-8 rounded-md text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="How it works" @click="info?.open()">?</button>
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="load(selected ?? undefined)">rescan</button>
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="Reset positions to the automatic layout" @click="reorder">reorder</button>
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" :aria-pressed="dark" @click="setDark(!dark)">{{ dark ? 'light' : 'dark' }}</button>
        <button class="ml-1 h-8 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-primary/90" @click="mode = 'create'; selected = null; panelOpen = true">new doc</button>
        <button class="h-8 w-8 rounded-md text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" :title="panelOpen ? 'Hide panel' : 'Show panel'" :aria-pressed="panelOpen" @click="togglePanel()">
          <svg viewBox="0 0 16 16" class="mx-auto size-4" fill="none" stroke="currentColor" stroke-width="1.25"><rect x="1.5" y="2.5" width="13" height="11" rx="2" /><path d="M10 2.5v11" /><path v-if="panelOpen" d="M10 8h4.5" class="stroke-accent-orange" stroke-width="2" /></svg>
        </button>
      </div>
    </header>
    <InfoDialog v-if="graph" ref="info" :entry="graph.entry" :docs="graph.docs" />

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
        <template v-if="mode === 'create' && graph">
          <h2 class="mb-4 font-display text-[24px] leading-none">new doc</h2>
          <NewDocForm :graph="graph" @created="load($event)" @cancel="mode = 'view'" />
        </template>
        <template v-else-if="selected">
          <div class="mb-4 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <code class="truncate">{{ selected }}</code>
            <button class="shrink-0 hover:text-foreground" @click="selected = null">close</button>
          </div>
          <article class="prose-doc" @click="onProseClick" v-html="html" />
        </template>
        <div v-else class="flex h-full flex-col justify-center gap-2 text-center text-[13px] text-muted-foreground">
          <p class="font-display text-[22px] text-foreground">nothing selected</p>
          <p>click a doc to read it, or drag them around.<br />arrows point from the doc that references to the doc it references.</p>
        </div>
      </aside>
    </div>
  </div>
</template>
