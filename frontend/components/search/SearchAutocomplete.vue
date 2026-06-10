<template>
  <div v-if="open" class="search-ac bg-white border border-line rounded-b-xl shadow-lg overflow-hidden">
    <!-- 빈 입력: 최근 + 인기 -->
    <template v-if="!query">
      <div v-if="recent.length" class="pt-2">
        <div class="px-4 py-1 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500">최근 검색</span>
          <button class="text-[11px] text-slate-400 hover:text-slate-600" @mousedown.prevent @click="clearRecent">전체 삭제</button>
        </div>
        <ul class="pb-1">
          <li
            v-for="kw in recent"
            :key="kw"
            class="flex items-center justify-between px-4 py-2 hover:bg-slate-50 cursor-pointer"
            @mousedown.prevent
            @click="goKeyword(kw)"
          >
            <span class="flex items-center gap-2.5 text-sm">
              <span class="material-symbols-outlined text-slate-400 text-[18px]">history</span>
              {{ kw }}
            </span>
            <span
              class="material-symbols-outlined text-slate-300 text-[16px] hover:text-slate-500"
              @mousedown.prevent
              @click.stop="removeRecent(kw)"
            >close</span>
          </li>
        </ul>
      </div>
      <div v-if="popular.length" class="px-4 pt-2 pb-3 border-t border-slate-100">
        <p class="text-xs font-bold text-slate-500 mb-2">인기 검색</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(kw, i) in popular"
            :key="kw"
            class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-line rounded-full text-xs hover:border-primary/40 hover:text-primary"
            @mousedown.prevent
            @click="goKeyword(kw)"
          >
            <span class="text-primary font-bold">{{ i + 1 }}</span> {{ kw }}
          </button>
        </div>
      </div>
    </template>

    <!-- 입력 중: 추천 섹션 -->
    <template v-else>
      <ul>
        <li
          v-for="(it, idx) in items"
          :key="idx"
          :data-suggest-type="it.type"
          class="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 cursor-pointer"
          @mousedown.prevent
          @click="select(it)"
        >
          <span class="material-symbols-outlined text-slate-400 text-[18px]">{{ icon(it.type) }}</span>
          <span class="text-sm flex-1 truncate">
            {{ it.label }}
            <span v-if="it.sublabel" class="text-slate-400 text-xs"> · {{ it.sublabel }}</span>
          </span>
        </li>
      </ul>
      <div
        class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-2.5 border-t border-slate-100"
        @mousedown.prevent
        @click="goKeyword(query)"
      >
        <span class="material-symbols-outlined text-primary text-[18px]">search</span>
        <span class="text-sm">"{{ query }}" 통합 검색 결과 보기</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSearchSuggest, type SuggestItem } from '~/composables/useSearchSuggest'
import { useAnalytics } from '~/composables/useAnalytics'
import { CITY_FULL_NAME_TO_SLUG, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { toRealEstateUrl, isRealEstateUrlType } from '~/utils/realEstateUrl'

const props = defineProps<{ open: boolean; modelValue: string }>()
const emit = defineEmits<{ close: [] }>()

const { items, popular, recent, suggest, loadPopular, addRecent, removeRecent, clearRecent } =
  useSearchSuggest()
const { trackSuggestSelect } = useAnalytics()

const query = computed(() => props.modelValue.trim())

watch(
  () => props.modelValue,
  (v) => suggest(v),
  { immediate: true },
)

watch(
  () => props.open,
  (o) => {
    if (o && popular.value.length === 0) loadPopular()
  },
  { immediate: true },
)

function icon(t: SuggestItem['type']): string {
  return t === 'region' ? 'location_on' : t === 'building' ? 'apartment' : 'category'
}

function goKeyword(kw: string) {
  const k = kw.trim()
  if (!k) return
  addRecent(k)
  emit('close')
  navigateTo('/search?keyword=' + encodeURIComponent(k))
}

function select(it: SuggestItem) {
  addRecent(it.label)
  trackSuggestSelect({ keyword: it.label, suggestType: it.type })
  emit('close')
  if (it.type === 'region' && it.city) {
    const c = CITY_FULL_NAME_TO_SLUG[it.city]
    const d = it.district ? DISTRICT_SLUG_MAP[it.district] : ''
    navigateTo(d ? `/${c}/${d}` : `/${c}`)
  } else if (it.type === 'category' && it.category) {
    const c = it.city ? CITY_FULL_NAME_TO_SLUG[it.city] : ''
    const d = it.district ? DISTRICT_SLUG_MAP[it.district] : ''
    navigateTo(c && d ? `/${c}/${d}/${it.category}` : `/${it.category}`)
  } else if (
    it.type === 'building' &&
    it.buildingName &&
    it.reType &&
    isRealEstateUrlType(it.reType) &&
    it.city &&
    it.district
  ) {
    navigateTo(
      toRealEstateUrl({ type: it.reType, city: it.city, district: it.district, buildingName: it.buildingName }),
    )
  } else {
    navigateTo('/search?keyword=' + encodeURIComponent(it.label))
  }
}
</script>
