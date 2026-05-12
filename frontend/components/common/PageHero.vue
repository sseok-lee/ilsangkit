<template>
  <section class="p-4 md:p-5 bg-white border border-line rounded-xl shadow-card">
    <!-- Main (eyebrow + title + desc + search slot) -->
    <div>
      <span v-if="eyebrow" class="inline-flex mb-3 px-2 py-1 bg-primary/10 text-primary rounded text-eyebrow">
        {{ eyebrow }}
      </span>
      <h1
        class="text-display-1 text-slate-900 mb-2"
        :class="$slots.badge ? 'flex items-center gap-2 flex-wrap' : ''"
      >
        <slot name="title">{{ title }}</slot>
        <span v-if="$slots.badge" data-test="badge-wrap" class="inline-flex">
          <slot name="badge" />
        </span>
      </h1>
      <p v-if="description || $slots.description" class="text-body text-slate-500">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot name="search" />
    </div>

    <!-- Inline summary-grid (below main) -->
    <div
      v-if="stats?.length || $slots.sidebar"
      class="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8"
    >
      <slot name="sidebar">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="min-w-0 sm:flex-initial sm:max-w-xs"
        >
          <span class="block text-caption text-slate-400">{{ stat.label }}</span>
          <strong
            class="block mt-1 text-display-3 break-keep"
            :class="stat.color ?? 'text-slate-900'"
          >
            {{ stat.value }}
          </strong>
        </div>
      </slot>
    </div>

    <div
      v-if="actions.length > 0"
      data-test="hero-actions"
      class="mt-4 flex gap-2"
    >
      <div
        v-for="action in actions"
        :key="action.type"
        class="relative flex-1"
      >
        <component
          :is="action.href ? 'a' : 'button'"
          :href="action.href"
          :target="action.href && action.type === 'directions' ? '_blank' : undefined"
          :rel="action.href && action.type === 'directions' ? 'noopener noreferrer' : undefined"
          data-test="hero-action"
          class="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          :class="action.primary
            ? 'bg-primary text-white hover:bg-blue-600'
            : 'bg-white border border-line text-slate-700 hover:border-primary hover:text-primary'"
          @click="(e) => onActionClick(action, e)"
        >
          {{ action.label }}
        </component>
        <div
          v-if="action.menu && openMenu === action.type"
          data-test="hero-action-menu"
          class="absolute left-0 right-0 top-full mt-2 z-20 rounded-xl border border-line bg-white shadow-lg overflow-hidden"
        >
          <a
            v-for="item in action.menu"
            :key="item.href"
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-gray-50"
            @click="closeMenu"
          >
            <img v-if="item.iconSrc" :src="item.iconSrc" alt="" class="w-5 h-5 rounded" />
            {{ item.label }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Stat {
  label: string
  value: string
  color?: string
}

export interface HeroActionMenuItem {
  label: string
  href: string
  iconSrc?: string
}

export interface HeroAction {
  type: 'directions' | 'phone' | 'share'
  label: string
  href?: string
  primary?: boolean
  menu?: HeroActionMenuItem[]
}

withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  stats?: Stat[]
  actions?: HeroAction[]
}>(), {
  eyebrow: '',
  title: '',
  description: '',
  stats: () => [],
  actions: () => [],
})

const emit = defineEmits<{
  (e: 'action', payload: { type: HeroAction['type'] }): void
}>()

const openMenu = ref<HeroAction['type'] | null>(null)

function onActionClick(action: HeroAction, event: Event) {
  if (action.menu && action.menu.length > 0) {
    event.preventDefault()
    openMenu.value = openMenu.value === action.type ? null : action.type
    return
  }
  if (!action.href) {
    event.preventDefault()
    emit('action', { type: action.type })
  }
}

function closeMenu() {
  openMenu.value = null
}
</script>
