<template>
  <div
    v-if="open"
    class="search-ac bg-white border border-line rounded-b-xl shadow-lg overflow-hidden"
    role="listbox"
  >
    <!-- 빈 입력: 최근 + 인기 -->
    <template v-if="!query">
      <div v-if="recent.length" class="pt-2">
        <div class="px-4 py-1 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500">최근 검색</span>
          <button class="text-[11px] text-slate-400 hover:text-slate-600" @mousedown.prevent @click="clearRecent">전체 삭제</button>
        </div>
        <ul class="pb-1">
          <li
            v-for="(kw, idx) in recent"
            :key="kw"
            role="option"
            :aria-selected="recentEntryIndex(idx) === activeIndex"
            class="flex items-center justify-between px-4 py-2 hover:bg-slate-50 cursor-pointer"
            :class="{ 'bg-primary-50': recentEntryIndex(idx) === activeIndex }"
            @mousedown.prevent
            @click="goKeyword(kw)"
          >
            <span class="flex items-center gap-2.5 text-sm">
              <span class="material-symbols-outlined text-slate-400 text-[18px]">history</span>
              {{ kw }}
            </span>
            <button
              type="button"
              aria-label="최근 검색어 삭제"
              class="material-symbols-outlined text-slate-300 text-[16px] hover:text-slate-500"
              @mousedown.prevent
              @click.stop="removeRecent(kw)"
            >
close
</button>
          </li>
        </ul>
      </div>
      <div v-if="popular.length" class="px-4 pt-2 pb-3 border-t border-slate-100">
        <p class="text-xs font-bold text-slate-500 mb-2">인기 검색</p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(kw, i) in popular"
            :key="kw"
            role="option"
            :aria-selected="popularEntryIndex(i) === activeIndex"
            class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-line rounded-full text-xs hover:border-primary/40 hover:text-primary"
            :class="{ 'border-primary text-primary': popularEntryIndex(i) === activeIndex }"
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
          role="option"
          :aria-selected="idx === activeIndex"
          :data-suggest-type="it.type"
          class="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 cursor-pointer"
          :class="{ 'bg-primary-50': idx === activeIndex }"
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
        role="option"
        :aria-selected="items.length === activeIndex"
        class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-2.5 border-t border-slate-100"
        :class="{ 'bg-primary-50': items.length === activeIndex }"
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
import { computed, ref, watch } from 'vue'
import { useSearchSuggest, type SuggestItem } from '~/composables/useSearchSuggest'
import { useAnalytics } from '~/composables/useAnalytics'
import { CITY_FULL_NAME_TO_SLUG, CITY_SLUGS, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { toRealEstateUrl, isRealEstateUrlType } from '~/utils/realEstateUrl'

const props = defineProps<{ open: boolean; modelValue: string }>()
const emit = defineEmits<{ close: [] }>()

const { items, popular, recent, suggest, loadPopular, addRecent, removeRecent, clearRecent } =
  useSearchSuggest()
const { trackSuggestSelect } = useAnalytics()

const query = computed(() => props.modelValue.trim())

// ── Flat entries list for keyboard nav ──────────────────────────────────────

type Entry =
  | { kind: 'keyword'; keyword: string }
  | { kind: 'item'; item: SuggestItem }
  | { kind: 'search'; keyword: string }

const activeIndex = ref(-1)

const entries = computed<Entry[]>(() => {
  if (!query.value) {
    const recEntries: Entry[] = recent.value.map((kw) => ({ kind: 'keyword', keyword: kw }))
    const popEntries: Entry[] = popular.value.map((kw) => ({ kind: 'keyword', keyword: kw }))
    return [...recEntries, ...popEntries]
  }
  const itemEntries: Entry[] = items.value.map((it) => ({ kind: 'item', item: it }))
  return [...itemEntries, { kind: 'search', keyword: query.value }]
})

// Helper: map section-local index back to flat entries index for ARIA
function recentEntryIndex(localIdx: number): number {
  return localIdx
}
function popularEntryIndex(localIdx: number): number {
  return recent.value.length + localIdx
}

watch(
  () => props.modelValue,
  (v) => {
    suggest(v)
    activeIndex.value = -1
  },
  { immediate: true },
)

watch(
  () => props.open,
  (o) => {
    if (o && popular.value.length === 0) loadPopular()
    activeIndex.value = -1
  },
  { immediate: true },
)

function onKeydown(e: KeyboardEvent): boolean {
  const key = e.key.toLowerCase()
  if (key === 'arrowdown') {
    e.preventDefault()
    if (entries.value.length === 0) return true
    activeIndex.value = (activeIndex.value + 1) % entries.value.length
    return true
  }
  if (key === 'arrowup') {
    e.preventDefault()
    if (entries.value.length === 0) return true
    activeIndex.value =
      activeIndex.value <= 0 ? entries.value.length - 1 : activeIndex.value - 1
    return true
  }
  if (key === 'enter') {
    if (activeIndex.value >= 0 && activeIndex.value < entries.value.length) {
      e.preventDefault()
      const entry = entries.value[activeIndex.value]
      if (entry.kind === 'item') {
        select(entry.item)
      } else {
        goKeyword(entry.keyword)
      }
      return true
    }
    return false
  }
  if (key === 'escape') {
    e.preventDefault()
    activeIndex.value = -1
    emit('close')
    return true
  }
  return false
}

defineExpose({ onKeydown })

// ── Helpers ─────────────────────────────────────────────────────────────────

function citySlug(city: string | undefined): string {
  if (!city) return ''
  return CITY_FULL_NAME_TO_SLUG[city] || CITY_SLUGS[city] || ''
}

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
    const c = citySlug(it.city)
    const d = it.district ? DISTRICT_SLUG_MAP[it.district] : ''
    navigateTo(d ? `/${c}/${d}` : `/${c}`)
  } else if (it.type === 'category' && it.category) {
    const c = it.city ? citySlug(it.city) : ''
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
