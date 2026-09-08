<script setup lang="ts">
// Pick which folder is scanned: every folder in the repo that holds markdown, with counts.
import { computed, ref } from 'vue'
import { api, type Folder } from '../api'

defineProps<{ current: string }>()
const emit = defineEmits<{ pick: [path: string] }>()
const el = ref<HTMLDialogElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const folders = ref<Folder[] | null>(null)
const error = ref('')
const filter = ref('')
const shown = computed(() => (folders.value ?? []).filter((f) => f.path.toLowerCase().includes(filter.value.toLowerCase())))

async function open() {
  el.value?.showModal()
  filter.value = ''
  requestAnimationFrame(() => input.value?.focus())
  if (folders.value) return
  try { folders.value = await api.folders() } catch (e) { error.value = (e as Error).message }
}
defineExpose({ open })
function pick(path: string) {
  el.value?.close()
  emit('pick', path)
}
</script>

<template>
  <dialog ref="el" class="m-auto w-[min(92vw,460px)] rounded-lg border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-foreground/30 backdrop:backdrop-blur-[2px]" @click.self="el?.close()">
    <div class="px-5 pt-5 pb-3">
      <div class="mb-3 flex items-baseline justify-between gap-3">
        <h2 class="font-display text-[24px] leading-none">scan folder</h2>
        <button class="text-[12px] text-muted-foreground hover:text-foreground" @click="el?.close()">close</button>
      </div>
      <input ref="input" v-model="filter" placeholder="filter folders…" spellcheck="false" class="h-9 w-full rounded-md border bg-background px-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30" @keydown.enter.prevent="shown[0] && pick(shown[0].path)" />
    </div>
    <ul class="max-h-[50vh] overflow-y-auto border-t px-2 py-2">
      <li v-for="f in shown" :key="f.path">
        <button class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-1.5 text-left text-[13px] hover:bg-accent" :aria-current="f.path === current ? 'true' : undefined" :class="f.path === current && 'bg-accent/60 font-medium'" @click="pick(f.path)">
          <span class="truncate">{{ f.path === '.' ? 'whole repo' : f.path }}</span>
          <span class="shrink-0 text-[11px] tabular-nums text-muted-foreground">{{ f.count }} md</span>
        </button>
      </li>
      <li v-if="folders && !shown.length" class="px-3 py-2 text-[12.5px] text-muted-foreground">no folder matches</li>
      <li v-if="!folders && !error" class="px-3 py-2 text-[12.5px] text-muted-foreground">loading…</li>
      <li v-if="error" class="px-3 py-2 text-[12.5px] text-destructive">{{ error }}</li>
    </ul>
  </dialog>
</template>
