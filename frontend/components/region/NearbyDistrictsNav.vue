<template>
  <nav
    v-if="districts.length > 0"
    :aria-label="`주변 지역 ${categoryLabel}`"
  >
    <h3 class="ui-h3 text-strong mb-3">주변 지역 {{ categoryLabel }}</h3>
    <ul class="flex flex-wrap gap-2">
      <li v-for="d in districts" :key="d.slug">
        <UiChip :to="`/${citySlug}/${d.slug}/${category}`">
          <span class="font-medium">{{ d.district }}</span>
          <span class="text-xs text-muted tabular-nums">{{ d.count.toLocaleString() }}곳</span>
        </UiChip>
      </li>
    </ul>
  </nav>
</template>

<script setup lang="ts">
import UiChip from '~/components/common/UiChip.vue'

interface District {
  slug: string
  district: string
  count: number
}

interface Props {
  citySlug: string
  category: string
  categoryLabel: string
  districts: District[]
}

defineProps<Props>()
</script>
