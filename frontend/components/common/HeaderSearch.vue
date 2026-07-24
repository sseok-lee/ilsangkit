<template>
  <div class="relative">
    <!-- 데스크톱 인라인 입력 -->
    <div
      v-if="variant === 'desktop'"
      class="hidden md:flex items-center gap-2 bg-surface-2 border border-line rounded-lg px-3 h-10 w-full focus-within:border-primary focus-within:bg-white transition-colors"
    >
      <span class="material-symbols-outlined text-faint text-[20px]">search</span>
      <input
        v-model="keyword"
        aria-label="통합 검색"
        class="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
        :placeholder="placeholder"
        @focus="focused = true"
        @blur="focused = false"
        @input="(e) => acDesktopRef?.setQuery?.((e.target as HTMLInputElement).value)"
        @keydown="(e) => onInputKeydown(e, acDesktopRef)"
      />
    </div>
    <div v-if="variant === 'desktop'" class="hidden md:block absolute left-0 right-0 top-full z-50">
      <SearchAutocomplete ref="acDesktopRef" :open="focused" :model-value="keyword" @close="focused = false" />
    </div>

    <!-- 모바일 아이콘 + 전체화면 오버레이 -->
    <template v-else>
      <button
        class="flex items-center justify-center size-11 rounded-full hover:bg-black/5 transition-colors text-strong"
        aria-label="검색 열기"
        @click="overlayOpen = true"
      >
        <span class="material-symbols-outlined text-[26px]">search</span>
      </button>

      <div v-if="overlayOpen" class="fixed inset-0 z-[60] bg-white" role="dialog" aria-label="검색">
        <div class="flex items-center gap-2 px-3 h-14 border-b border-line">
          <button aria-label="검색 닫기" class="flex items-center text-muted" @click="overlayOpen = false">
            <span class="material-symbols-outlined">arrow_back</span>
          </button>
          <div class="flex-1 flex items-center gap-1.5 bg-surface-2 border border-primary rounded-lg px-2 h-9">
            <span class="material-symbols-outlined text-faint text-[18px]">search</span>
            <input
              ref="overlayInput"
              v-model="keyword"
              aria-label="통합 검색"
              class="flex-1 bg-transparent text-sm focus:outline-none"
              :placeholder="placeholder"
              @input="(e) => acMobileRef?.setQuery?.((e.target as HTMLInputElement).value)"
              @keydown="(e) => onInputKeydown(e, acMobileRef)"
            />
          </div>
        </div>
        <SearchAutocomplete ref="acMobileRef" :open="overlayOpen" :model-value="keyword" @close="overlayOpen = false" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useAnalytics } from '~/composables/useAnalytics'
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue'

withDefaults(defineProps<{ variant?: 'desktop' | 'mobile' }>(), {
  variant: 'desktop',
})

const keyword = ref('')
const overlayOpen = ref(false)
const focused = ref(false)
const overlayInput = ref<HTMLInputElement | null>(null)
const acDesktopRef = ref<InstanceType<typeof SearchAutocomplete> | null>(null)
const acMobileRef = ref<InstanceType<typeof SearchAutocomplete> | null>(null)
const { trackSearch } = useAnalytics()

const placeholder = '장소·단지명·시설명 검색'

function submit() {
  const q = keyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  overlayOpen.value = false
  navigateTo('/search?keyword=' + encodeURIComponent(q))
}

function onInputKeydown(
  e: KeyboardEvent,
  acRef: InstanceType<typeof SearchAutocomplete> | null,
) {
  const handled = (acRef as { onKeydown?: (e: KeyboardEvent) => boolean } | null)?.onKeydown?.(e)
  if (!handled && e.key.toLowerCase() === 'enter') submit()
}

watch(overlayOpen, async (open) => {
  if (!import.meta.client) return
  if (open) {
    await nextTick()
    overlayInput.value?.focus()
  }
})
</script>
