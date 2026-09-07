<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { VueFlow, useVueFlow, type Edge as FlowEdge, type Node as FlowNode } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import { marked } from 'marked'
import { api, type Graph } from './api'
import { toFlow } from './layout'
import DocNode from './components/DocNode.vue'
import NewDocForm from './components/NewDocForm.vue'

const graph = ref<Graph | null>(null)
const nodes = shallowRef<FlowNode[]>([])
const edges = shallowRef<FlowEdge[]>([])
const selected = ref<string | null>(null)
const content = ref('')
const mode = ref<'view' | 'create'>('view')
const loadError = ref('')
const { fitView } = useVueFlow()

// Recompute the dagre layout from the current graph and fit it into view.
function reorder() {
  if (!graph.value) return
  const f = toFlow(graph.value)
  nodes.value = f.nodes
  edges.value = f.edges
  highlight(selected.value)
  requestAnimationFrame(() => fitView({ padding: 0.15, duration: 300 }))
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
  content.value = (await api.file(path)).content
}

// Highlight the edges touching the selected node; dim the rest.
function highlight(s: string | null) {
  for (const e of edges.value) e.class = !s ? '' : e.source === s || e.target === s ? 'lit' : 'dim'
  edges.value = [...edges.value]
}
watch(selected, highlight)

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
  try { localStorage.setItem('ctx-graph:dark', String(v)) } catch {}
}
onMounted(() => {
  let stored: string | null = null
  try { stored = localStorage.getItem('ctx-graph:dark') } catch {}
  setDark(stored ? stored === 'true' : matchMedia('(prefers-color-scheme: dark)').matches)
  load()
})

const rootName = computed(() => graph.value?.root.split('/').pop())
</script>

<template>
  <div class="grid h-full grid-rows-[auto_1fr]">
    <header class="flex items-center justify-between border-b px-5 py-3">
      <div class="flex items-baseline gap-3">
        <h1 class="font-display text-[22px] leading-none">ctx-graph</h1>
        <span v-if="graph" class="text-[12.5px] text-muted-foreground">
          <span class="text-foreground">{{ rootName }}</span> · {{ graph.entry }} · {{ graph.nodes.length }} docs · {{ graph.edges.length }} links
        </span>
      </div>
      <div class="flex items-center gap-1.5">
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="load(selected ?? undefined)">rescan</button>
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" title="Reset positions to the automatic layout" @click="reorder">reorder</button>
        <button class="h-8 rounded-md px-2.5 text-[12.5px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" :aria-pressed="dark" @click="setDark(!dark)">{{ dark ? 'light' : 'dark' }}</button>
        <button class="ml-1 h-8 rounded-md bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-primary/90" @click="mode = 'create'; selected = null">new doc</button>
      </div>
    </header>

    <div class="grid min-h-0 grid-cols-[1fr_360px]">
      <div class="relative min-h-0">
        <VueFlow
          v-model:nodes="nodes"
          v-model:edges="edges"
          :min-zoom="0.2"
          :max-zoom="2"
          :nodes-draggable="true"
          :nodes-connectable="false"
          :elements-selectable="true"
          fit-view-on-init
          @node-click="select($event.node.id)"
          @pane-click="selected = null"
        >
          <template #node-doc="p"><DocNode :data="p.data" :selected="p.id === selected" /></template>
          <Background pattern-color="var(--dot)" :gap="22" :size="1.2" />
          <Controls :show-interactive="false" position="bottom-left" />
        </VueFlow>
        <p v-if="loadError" class="absolute inset-x-0 top-4 mx-auto w-max rounded-md border border-destructive/40 bg-card px-3 py-2 text-[12.5px] text-destructive">{{ loadError }}</p>
      </div>

      <aside class="min-h-0 overflow-y-auto border-l bg-card/60 px-6 py-5">
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
