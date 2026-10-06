<!-- frontend/components/common/MobileDetailHeader.vue
     시설·부동산·토지·공매·청약·공공임대 상세의 공용 모바일 핵심정보 헤더.
     literal <h1> 1개 소유(단일 h1 불변식). 데스크톱은 PageHead(title-tag="div")가 대체. -->
<template>
  <section class="md:hidden page-head" data-variant="flat">
    <p v-if="eyebrow" data-test="eyebrow" class="page-head__eyebrow">{{ eyebrow }}</p>
    <div class="flex items-start gap-2 flex-wrap">
      <h1 class="ui-h1 text-strong min-w-0 break-keep [overflow-wrap:anywhere]">{{ title }}</h1>
      <OperatingStatusBadge v-if="status" :status="status" class="mt-1.5 shrink-0" />
    </div>
    <div v-if="$slots.address" data-test="address" class="mt-2 text-[15px] leading-relaxed text-muted">
      <slot name="address" />
    </div>
    <SummaryRow v-if="summaryItems.length" class="mt-4" :items="summaryItems" />
    <div class="mt-4 flex gap-2">
      <UiButton v-if="phone" variant="secondary" :href="`tel:${phone}`" data-test="call-pill" class="flex-1 min-w-0 px-2">
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">call</span>전화
      </UiButton>
      <UiButton v-if="copyable" variant="secondary" data-test="copy-pill" class="flex-1 min-w-0 px-2" @click="$emit('copy')">
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">content_copy</span>복사
      </UiButton>
      <UiButton variant="secondary" data-test="share-pill" class="flex-1 min-w-0 px-2" :aria-label="shareLabel" @click="$emit('share')">
        <span class="material-symbols-outlined text-[18px]" aria-hidden="true">share</span>공유
      </UiButton>
      <div v-if="!hideDirections" class="relative flex-[1.4] min-w-0">
        <UiButton
          variant="primary"
          data-test="directions-pill"
          class="w-full px-3"
          :aria-expanded="showNav"
          aria-haspopup="menu"
          @click="showNav = !showNav"
        >
          <span class="material-symbols-outlined text-[18px]" aria-hidden="true">directions</span>길찾기
        </UiButton>
        <div v-if="showNav" class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-[10px] shadow-card-2 border border-line overflow-hidden z-20">
          <button data-test="directions-kakao" class="w-full min-h-[44px] px-4 py-3 text-left text-sm font-medium text-ink hover:bg-background-light flex items-center gap-3" @click="emitDirections('kakao')">
            <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
          </button>
          <div class="h-px bg-line"></div>
          <button data-test="directions-naver" class="w-full min-h-[44px] px-4 py-3 text-left text-sm font-medium text-ink hover:bg-background-light flex items-center gap-3" @click="emitDirections('naver')">
            <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import SummaryRow from '~/components/common/SummaryRow.vue'
import type { SummaryItem } from '~/components/common/SummaryRow.vue'
import UiButton from '~/components/common/UiButton.vue'
import OperatingStatusBadge from '~/components/facility/OperatingStatusBadge.vue'

type OperatingStatus = 'open24h' | 'openNow' | 'closed' | 'limited'
interface Stat { label: string; value: string; color?: string }

// kakaoMapUrl/naverMapUrl: 길찾기 URL은 부모가 directions emit을 받아 처리. 선언만 유지(속성 fall-through 방지).
const props = withDefaults(defineProps<{
  title: string
  eyebrow?: string
  status?: OperatingStatus | null
  stats?: Stat[]
  phone?: string | null
  copyable?: boolean
  hideDirections?: boolean
  shareLabel?: string
  kakaoMapUrl?: string
  naverMapUrl?: string
  variant?: 'flat'
}>(), {
  copyable: false,
  hideDirections: false,
  shareLabel: '공유하기',
  variant: 'flat',
})

const emit = defineEmits<{
  (e: 'share'): void
  (e: 'copy'): void
  (e: 'directions', provider: 'kakao' | 'naver'): void
}>()

// flat 은 stats 를 SummaryRow 로. 부동산 상세가 넘기는 color='text-primary' 만 brand tone 으로 옮긴다.
const summaryItems = computed<SummaryItem[]>(() =>
  (props.stats ?? []).map((s) => ({
    label: s.label,
    value: s.value,
    tone: s.color === 'text-primary' ? 'brand' : undefined,
  })),
)

const showNav = ref(false)
function emitDirections(provider: 'kakao' | 'naver') {
  emit('directions', provider)
  showNav.value = false
}
</script>
