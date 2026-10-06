<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, REGIONS, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { landRegionHref } from '~/utils/landRegionNavigation'
import HardLink from '~/components/common/HardLink.vue'
const props = defineProps<{ citySlug: string; districtSlug?: string }>()
const districts = computed(() => REGIONS[CITY_SLUG_MAP[props.citySlug]] ?? [])
</script>

<template>
  <div class="land-region-stages" :class="{ 'has-district': districtSlug }">
    <nav class="land-parent-stage" aria-label="토지 시·도 선택">
      <h2>시·도</h2>
      <HardLink v-for="(name, slug) in CITY_SLUG_MAP" :key="slug" :to="landRegionHref(String(slug))" :aria-current="slug === citySlug ? 'page' : undefined">{{ name }}</HardLink>
    </nav>
    <nav v-if="districtSlug" class="land-parent-stage" aria-label="토지 구·군 선택">
      <h2>구·군</h2>
      <HardLink v-for="name in districts" :key="name" :to="landRegionHref(citySlug, DISTRICT_SLUG_MAP[name] ?? name)" :aria-current="DISTRICT_SLUG_MAP[name] === districtSlug ? 'page' : undefined">{{ name }}</HardLink>
    </nav>
    <div class="min-w-0"><slot /></div>
  </div>
</template>

<style scoped>
.land-region-stages { display:grid; grid-template-columns:180px minmax(0,1fr); gap:28px; }
.land-region-stages.has-district { grid-template-columns:150px 180px minmax(0,1fr); }
.land-parent-stage { background:rgb(var(--paper-rgb)); border-radius:8px; padding:16px; align-self:start; max-height:560px; overflow-y:auto; }
.land-parent-stage h2 { font-size:16px; font-weight:700; padding:0 8px 12px; }
.land-parent-stage a { display:flex; align-items:center; min-height:44px; padding:8px; font-size:14px; border-bottom:1px solid rgb(var(--border-rgb)); }
.land-parent-stage a[aria-current] { color:rgb(var(--brand-rgb)); font-weight:700; background:rgb(var(--surface-rgb)); }
@media(max-width:767px) { .land-region-stages, .land-region-stages.has-district { display:block; } .land-parent-stage { display:none; } }
</style>
