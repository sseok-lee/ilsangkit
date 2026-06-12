<!-- frontend/components/realEstate/MobileRealEstateHeader.vue -->
<template>
  <section class="md:hidden bg-white border border-line rounded-xl shadow-card p-4">
    <span v-if="eyebrow" class="inline-flex items-center mb-2 px-2.5 py-1 bg-primary/10 text-primary rounded-full text-eyebrow">
      {{ eyebrow }}
    </span>
    <h1 class="text-display-1 text-strong break-keep">{{ title }}</h1>

    <div v-if="stats?.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="stat in stats"
        :key="stat.label"
        class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
      >
        <span class="text-slate-400">{{ stat.label }}</span>
        <span :class="['font-semibold', stat.color ?? 'text-slate-800']">{{ stat.value }}</span>
      </span>
    </div>

    <div class="mt-4 flex gap-2">
      <button
        data-test="share-pill"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
        aria-label="이 건물 공유하기"
        @click="$emit('share')"
      >
        <span class="material-symbols-outlined text-[18px]">share</span>공유
      </button>
      <div class="relative flex-[2]">
        <button
          data-test="directions-pill"
          class="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/30 active:scale-[0.98] transition"
          :aria-expanded="showNav"
          aria-haspopup="menu"
          @click="showNav = !showNav"
        >
          <span class="material-symbols-outlined text-[18px]">directions</span>길찾기
        </button>
        <div v-if="showNav" class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
          <button data-test="directions-kakao" class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3" @click="emitDirections('kakao')">
            <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
          </button>
          <div class="h-px bg-slate-100"></div>
          <button data-test="directions-naver" class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3" @click="emitDirections('naver')">
            <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Stat { label: string; value: string; color?: string }

// kakaoMapUrl/naverMapUrl: 길찾기 URL은 부모가 directions emit을 받아 처리. 미선언 시 속성 fall-through 방지 위해 선언만 유지.
defineProps<{
  title: string
  eyebrow?: string
  stats?: Stat[]
  kakaoMapUrl?: string
  naverMapUrl?: string
}>()

const emit = defineEmits<{
  (e: 'share'): void
  (e: 'directions', provider: 'kakao' | 'naver'): void
}>()

const showNav = ref(false)
function emitDirections(provider: 'kakao' | 'naver') {
  emit('directions', provider)
  showNav.value = false
}
</script>
