<template>
  <section v-if="sortedItems.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-display-2 text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">apartment</span>
          진행중 공공임대
        </h2>
        <p class="text-sm text-slate-500 mt-1">지금 모집 중인 공공임대 공고입니다.</p>
      </div>
      <HardLink to="/public-rental/announcements" class="inline-flex items-center min-h-[44px] text-sm text-primary font-bold hover:underline whitespace-nowrap">
        전체 보기 →
      </HardLink>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <HardLink
        v-for="item in sortedItems"
        :key="item.pblancId"
        :to="`/public-rental/announcements/${encodeURIComponent(item.pblancId)}`"
        class="flex flex-col gap-1.5 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md hover:border-primary-300 transition-shadow"
      >
        <span v-if="ddayLabel(item.endDe)" class="self-start text-[11px] font-bold text-primary">{{ ddayLabel(item.endDe) }}</span>
        <strong class="text-[14px] leading-snug text-slate-900 line-clamp-2">{{ item.pblancNm }}</strong>
        <p class="text-[11px] text-slate-400 mt-auto">{{ metaLine(item) }}</p>
      </HardLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'

interface RentalItem {
  pblancId: string
  pblancNm: string
  suplyTyNm?: string | null
  brtcNm?: string | null
  signguNm?: string | null
  endDe?: string | null
  totalSupply?: number | null
}

const props = defineProps<{ items: RentalItem[] }>()

// 마감임박순(endDe ASC). endDe 없는 항목은 뒤로.
const sortedItems = computed(() =>
  [...props.items].sort((a, b) => (a.endDe ?? '9999').localeCompare(b.endDe ?? '9999'))
)

// SSR/CSR 동일 "오늘" 보장 (기존 HomeSubscriptionSection 과 동일 key).
const todayIso = useState<string>('home-today-iso', () => new Date().toISOString().split('T')[0])
const MS_PER_DAY = 86_400_000

function ddayLabel(endDe?: string | null): string {
  if (!endDe) return ''
  const target = new Date(endDe)
  if (Number.isNaN(target.getTime())) return ''
  const today = new Date(`${todayIso.value}T00:00:00`)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
  if (diff < 0) return ''
  if (diff === 0) return 'D-Day'
  return `D-${diff}`
}

function metaLine(item: RentalItem): string {
  const parts: string[] = []
  const region = [item.brtcNm, item.signguNm].filter(Boolean).join(' ')
  if (region) parts.push(region)
  if (item.suplyTyNm) parts.push(item.suplyTyNm)
  if (item.totalSupply != null) parts.push(`${item.totalSupply.toLocaleString('ko-KR')}호`)
  return parts.join(' · ')
}
</script>
