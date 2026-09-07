<script setup lang="ts">
// Linked docs for the selected card: inbound fan in from above, outbound fan out below, legend beneath.
import { computed } from 'vue'
import type { Graph } from '../api'
import { folderColor } from '../layout'

const props = defineProps<{ graph: Graph; path: string }>()
const emit = defineEmits<{ go: [path: string] }>()

interface Linked { path: string; count: number; color: string }
const inbound = computed<Linked[]>(() => props.graph.edges.filter((e) => e.to === props.path).map((e) => ({ path: e.from, count: e.count, color: folderColor(e.from) })))
const outbound = computed<Linked[]>(() => props.graph.edges.filter((e) => e.from === props.path).map((e) => ({ path: e.to, count: e.count, color: folderColor(e.to) })))

const W = 312
const MID = 62
const H = 118
const x = (i: number, n: number) => (W / (n + 1)) * (i + 1)
const nameOf = (p: string) => p.split('/').pop()
// Many neighbours: the fan stays, the legend switches to a compact wrap.
const compact = computed(() => inbound.value.length + outbound.value.length > 16)
</script>

<template>
  <div v-if="inbound.length || outbound.length" class="mb-5 rounded-md border bg-card px-2 pb-1 pt-2">
    <svg :viewBox="`0 0 ${W} ${H}`" class="block w-full" style="overflow: visible" aria-hidden="true">
      <g v-for="(l, i) in inbound" :key="'i' + l.path" class="fan" :style="{ '--i': i }">
        <path :d="`M${x(i, inbound.length)} 14 C ${x(i, inbound.length)} ${MID - 22}, ${W / 2} ${MID - 30}, ${W / 2} ${MID - 12}`" fill="none" stroke="var(--accent-success)" stroke-opacity="0.45" stroke-width="1.25" />
        <circle :cx="x(i, inbound.length)" cy="12" r="5" :fill="l.color" class="cursor-pointer" @click="emit('go', l.path)"><title>{{ l.path }}</title></circle>
        <text v-if="l.count > 1 && inbound.length < 12" :x="x(i, inbound.length) + 8" y="9" font-size="9" fill="var(--muted-foreground)">{{ l.count }}</text>
      </g>
      <rect :x="W / 2 - 60" :y="MID - 12" width="120" height="24" rx="5" fill="var(--background)" stroke="var(--accent-orange)" stroke-width="1" />
      <text :x="W / 2" :y="MID + 4" text-anchor="middle" font-size="11" font-weight="500" fill="var(--foreground)">{{ nameOf(path) }}</text>
      <g v-for="(l, i) in outbound" :key="'o' + l.path" class="fan" :style="{ '--i': i }">
        <path :d="`M${W / 2} ${MID + 12} C ${W / 2} ${MID + 30}, ${x(i, outbound.length)} ${MID + 22}, ${x(i, outbound.length)} ${MID + 40}`" fill="none" stroke="var(--accent-orange)" stroke-opacity="0.55" stroke-width="1.25" marker-end="url(#linked-arrow)" />
        <circle :cx="x(i, outbound.length)" :cy="MID + 44" r="5" :fill="l.color" class="cursor-pointer" @click="emit('go', l.path)"><title>{{ l.path }}</title></circle>
      </g>
      <defs><marker id="linked-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0 L6 3 L0 6 z" fill="var(--accent-orange)" fill-opacity="0.7" /></marker></defs>
    </svg>
    <div class="grid grid-cols-2 gap-x-3 px-1 pt-1 text-[11px] leading-[18px]">
      <div>
        <div class="text-accent-success">↓ pointed from <span class="text-muted-foreground">{{ inbound.length }}</span></div>
        <div :class="compact ? 'flex flex-wrap gap-x-2' : ''">
          <button v-for="l in inbound" :key="l.path" class="block max-w-full truncate text-left leading-[22px] text-muted-foreground hover:text-foreground" :title="l.path" @click="emit('go', l.path)">
            <span class="mr-1 inline-block size-2 rounded-full align-middle" :style="{ background: l.color }" />{{ nameOf(l.path) }}<span v-if="l.count > 1" class="ml-1 text-[10px]">×{{ l.count }}</span>
          </button>
        </div>
      </div>
      <div>
        <div class="text-accent-orange">↑ points to <span class="text-muted-foreground">{{ outbound.length }}</span></div>
        <div :class="compact ? 'flex flex-wrap gap-x-2' : ''">
          <button v-for="l in outbound" :key="l.path" class="block max-w-full truncate text-left leading-[22px] text-muted-foreground hover:text-foreground" :title="l.path" @click="emit('go', l.path)">
            <span class="mr-1 inline-block size-2 rounded-full align-middle" :style="{ background: l.color }" />{{ nameOf(l.path) }}<span v-if="l.count > 1" class="ml-1 text-[10px]">×{{ l.count }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.fan { animation: fan-in 260ms cubic-bezier(0.23, 1, 0.32, 1) both; animation-delay: calc(var(--i) * 20ms); }
@keyframes fan-in { from { opacity: 0; } to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .fan { animation: none; } }
</style>
