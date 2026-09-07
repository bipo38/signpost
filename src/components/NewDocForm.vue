<script setup lang="ts">
import { computed, ref } from 'vue'
import { api, type Graph } from '../api'

const props = defineProps<{ graph: Graph }>()
const emit = defineEmits<{ created: [path: string]; cancel: [] }>()

const path = ref('')
const situation = ref('')
const body = ref('')
const file = ref<File | null>(null)
const parents = ref<string[]>([props.graph.entry])
const links = ref<string[]>([])
const returnRows = ref<string[]>([...props.graph.returnTables])
const error = ref('')
const busy = ref(false)
const dragging = ref(false)

const effectivePath = computed(() => path.value || (file.value ? `${props.graph.docs}/${file.value.name}` : ''))

async function pick(f: File | null | undefined) {
  if (!f) return
  file.value = f
  body.value = await f.text()
}

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const fd = new FormData()
    fd.set('path', effectivePath.value)
    fd.set('situation', situation.value)
    fd.set('body', body.value)
    for (const p of parents.value) fd.append('parents', p)
    for (const l of links.value) fd.append('links', l)
    for (const r of returnRows.value) fd.append('returnRows', r)
    const { path: created } = await api.create(fd)
    emit('created', created)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

const field = 'h-9 w-full rounded-md border bg-card px-3 text-[13px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30'
const label = 'mb-1.5 block text-[11px] font-medium lowercase tracking-wide text-muted-foreground'
</script>

<template>
  <form class="flex flex-col gap-5" @submit.prevent="submit">
    <div>
      <label :class="label" for="path">path</label>
      <input id="path" v-model="path" :class="field" :placeholder="`${graph.docs}/testing/perf.md`" spellcheck="false" />
      <p v-if="!path && file" class="mt-1 text-[11px] text-muted-foreground">defaults to <code class="rounded bg-muted px-1">{{ effectivePath }}</code></p>
    </div>

    <div>
      <label :class="label" for="situation">situation <span class="normal-case tracking-normal">· row in {{ graph.entry }}</span></label>
      <input id="situation" v-model="situation" :class="field" placeholder="Performance regression check" required />
    </div>

    <fieldset>
      <legend :class="label">link from</legend>
      <div class="grid grid-cols-1 gap-y-1.5">
        <label v-for="n in graph.nodes" :key="n.path" class="flex items-center gap-2.5 text-[13px]">
          <input v-model="parents" type="checkbox" :value="n.path" class="size-3.5 accent-[var(--accent-orange)]" />
          <span class="truncate">{{ n.path }}</span>
          <span v-if="n.path === graph.entry" class="text-[10px] text-muted-foreground">table row</span>
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend :class="label">links to <span class="normal-case tracking-normal">· "Related" line in the new doc</span></legend>
      <div class="grid grid-cols-1 gap-y-1.5">
        <label v-for="n in graph.nodes" :key="n.path" class="flex items-center gap-2.5 text-[13px]">
          <input v-model="links" type="checkbox" :value="n.path" class="size-3.5 accent-[var(--accent-orange)]" />
          <span class="truncate">{{ n.path }}</span>
        </label>
      </div>
    </fieldset>

    <fieldset v-if="graph.returnTables.length">
      <legend :class="label">return row</legend>
      <label v-for="r in graph.returnTables" :key="r" class="flex items-center gap-2.5 text-[13px]">
        <input v-model="returnRows" type="checkbox" :value="r" class="size-3.5 accent-[var(--accent-orange)]" />
        <span>add "Came from → Return to" row in <code class="rounded bg-muted px-1 text-[12px]">{{ r }}</code></span>
      </label>
    </fieldset>

    <div>
      <label :class="label" for="body">body <span class="normal-case tracking-normal">· template if empty</span></label>
      <div
        class="rounded-md border transition-colors"
        :class="dragging ? 'border-accent-orange bg-accent-orange/5' : 'bg-card'"
        @dragover.prevent="dragging = true"
        @dragleave="dragging = false"
        @drop.prevent="dragging = false; pick($event.dataTransfer?.files[0])"
      >
        <textarea id="body" v-model="body" rows="9" class="block w-full resize-y bg-transparent px-3 py-2 font-mono text-[12px] leading-relaxed outline-none placeholder:text-muted-foreground/70" placeholder="# Title&#10;&#10;Drop a .md here or leave empty for the template." spellcheck="false" />
        <div class="flex items-center justify-between border-t px-3 py-1.5 text-[11px] text-muted-foreground">
          <span v-if="file" class="truncate">{{ file.name }} · {{ file.size }} B</span>
          <span v-else>drop a .md file, or</span>
          <label class="cursor-pointer text-primary hover:underline underline-offset-3">
            upload<input type="file" accept=".md,text/markdown" class="hidden" @change="pick(($event.target as HTMLInputElement).files?.[0])" />
          </label>
        </div>
      </div>
    </div>

    <p v-if="error" class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12.5px] text-destructive">{{ error }}</p>

    <div class="flex items-center gap-2">
      <button type="submit" :disabled="busy || !effectivePath || !situation" class="h-9 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50">
        {{ busy ? 'creating…' : 'create doc' }}
      </button>
      <button type="button" class="h-9 rounded-md px-3 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" @click="emit('cancel')">cancel</button>
    </div>
  </form>
</template>
