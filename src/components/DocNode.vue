<script setup lang="ts">
import { Handle, Position } from '@vue-flow/core'

defineProps<{
  data: { path: string; title: string; entry: boolean; inbound: number; outbound: number }
  selected: boolean
}>()

const dirOf = (p: string) => p.split('/').slice(0, -1).join('/')
const nameOf = (p: string) => p.split('/').pop()
</script>

<template>
  <div
    class="relative w-[220px] h-[64px] rounded-md border bg-card px-3.5 py-2.5 text-left transition-[border-color,box-shadow] duration-150 ease-out hover:border-muted-foreground/40"
    :class="[selected && 'selected border-accent-orange/70 shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent-orange)_18%,transparent)]', data.entry && 'border-foreground/25']"
  >
    <span class="corner corner-tl" /><span class="corner corner-tr" />
    <span class="corner corner-bl" /><span class="corner corner-br" />
    <Handle type="target" :position="Position.Top" />
    <Handle type="source" :position="Position.Bottom" />

    <div class="flex items-baseline justify-between gap-2">
      <span class="truncate text-[13px] font-medium leading-tight">{{ nameOf(data.path) }}</span>
      <span v-if="data.entry" class="shrink-0 rounded-sm bg-foreground px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-background">entry</span>
    </div>
    <div class="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
      <span class="truncate">{{ dirOf(data.path) || '/' }}</span>
      <span class="shrink-0 tabular-nums" :title="`${data.inbound} references in · ${data.outbound} references out`">
        <span class="text-accent-success">↓{{ data.inbound }}</span>
        <span class="ml-1.5 text-accent-orange">↑{{ data.outbound }}</span>
      </span>
    </div>
  </div>
</template>
