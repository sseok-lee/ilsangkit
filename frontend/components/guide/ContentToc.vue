<script setup lang="ts">
import type { ReadingSection } from '~/utils/contentReading'

defineProps<{ items: ReadingSection[] }>()
</script>

<template>
  <aside v-if="items.length" class="min-w-0 text-sm text-muted">
    <nav aria-label="본문 목차" class="hidden md:block md:sticky md:top-28">
      <p class="mb-3 font-bold text-strong">목차</p>
      <ol>
        <li v-for="item in items" :key="item.id">
          <a :href="`#${encodeURIComponent(item.id)}`" class="flex min-h-11 items-center break-words py-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" :class="item.depth === 3 ? 'pl-3' : ''">
            <span v-html="item.labelHtml" />
          </a>
        </li>
      </ol>
    </nav>
    <details class="border-y border-line md:hidden">
      <summary class="min-h-11 cursor-pointer py-3 font-bold text-strong">목차</summary>
      <nav aria-label="본문 목차" class="pb-3">
        <ol>
          <li v-for="item in items" :key="item.id">
            <a :href="`#${encodeURIComponent(item.id)}`" class="flex min-h-11 items-center break-words py-2 hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" :class="item.depth === 3 ? 'pl-3' : ''">
              <span v-html="item.labelHtml" />
            </a>
          </li>
        </ol>
      </nav>
    </details>
  </aside>
</template>
