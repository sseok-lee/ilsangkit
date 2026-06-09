<template>
  <div class="relative">
    <!-- 데스크톱 인라인 -->
    <div class="hidden md:flex items-center gap-2 bg-slate-50 border border-line rounded-lg px-3 h-10 w-full focus-within:border-primary focus-within:bg-white transition-colors">
      <span class="material-symbols-outlined text-slate-400 text-[20px]">search</span>
      <input
        v-model="keyword"
        aria-label="통합 검색"
        class="flex-1 min-w-0 bg-transparent text-sm focus:outline-none"
        placeholder="지역·단지명·시설 검색"
        @keydown.enter="submit"
      />
    </div>
    <!-- 모바일 아이콘 -->
    <button
      class="md:hidden flex items-center justify-center w-10 h-10 text-slate-600"
      aria-label="검색 열기"
      @click="overlayOpen = true"
    >
      <span class="material-symbols-outlined">search</span>
    </button>

    <!-- 모바일 전체화면 오버레이 -->
    <div v-if="overlayOpen" class="fixed inset-0 z-50 bg-white md:hidden" role="dialog" aria-label="검색">
      <div class="flex items-center gap-2 px-3 h-14 border-b border-line">
        <button aria-label="검색 닫기" class="text-slate-500" @click="overlayOpen = false">
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <div class="flex-1 flex items-center gap-1.5 bg-slate-50 border border-primary rounded-lg px-2 h-9">
          <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
          <input
            ref="overlayInput"
            v-model="keyword"
            aria-label="통합 검색"
            class="flex-1 bg-transparent text-sm focus:outline-none"
            placeholder="지역·단지명·시설 검색"
            @keydown.enter="submit"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useAnalytics } from '~/composables/useAnalytics'

const keyword = ref('')
const overlayOpen = ref(false)
const overlayInput = ref<HTMLInputElement | null>(null)
const { trackSearch } = useAnalytics()

function submit() {
  const q = keyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  overlayOpen.value = false
  navigateTo('/search?keyword=' + encodeURIComponent(q))
}

watch(overlayOpen, async (open) => {
  if (!import.meta.client) return
  if (open) {
    await nextTick()
    overlayInput.value?.focus()
  }
})
</script>
