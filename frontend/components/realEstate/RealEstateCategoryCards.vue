<template>
  <div class="grid grid-cols-2 gap-3 md:gap-4">
    <HardLink
      v-for="entry in CARD_ORDER"
      :key="entry.type"
      :to="`/real-estate/${entry.type}`"
      data-test="hub-card"
      class="group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex size-9 md:size-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors"
        >
          <img
            :src="`/icons/category/${entry.iconImg}.webp?v2`"
            :alt="entry.label"
            class="w-6 h-6 md:w-7 md:h-7"
            width="28"
            height="28"
          />
        </div>
        <span
          data-test="hub-card-badge"
          :class="[
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
            entry.deal === 'sale'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-amber-100 text-amber-700',
          ]"
        >
          {{ entry.deal === 'sale' ? '매매' : '전월세' }}
        </span>
      </div>
      <p class="text-sm md:text-base font-semibold text-slate-800 group-hover:text-primary transition-colors leading-tight">
        {{ entry.label }}
      </p>
      <p v-if="countOf(entry.type) !== null" class="text-xs md:text-sm text-slate-700 tabular-nums">
        최근 30일 <span class="font-bold text-slate-900">{{ formatCount(countOf(entry.type)!) }}</span>건
      </p>
      <p
        v-else
        data-test="hub-card-count-placeholder"
        class="text-xs md:text-sm text-slate-400"
      >
        데이터 동기화 중
      </p>
    </HardLink>
  </div>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'

type HubType =
  | 'apt-sale' | 'apt-rent'
  | 'offitel-sale' | 'offitel-rent'
  | 'villa-sale' | 'villa-rent'

interface HubTypeEntry { last30dCount: number | null }

const props = defineProps<{
  summaries?: Partial<Record<HubType, HubTypeEntry>>
}>()

interface CardDef {
  type: HubType
  label: string
  iconImg: string
  deal: 'sale' | 'rent'
}

const CARD_ORDER: CardDef[] = [
  { type: 'apt-sale',     label: '아파트 매매',     iconImg: 'apt',     deal: 'sale' },
  { type: 'apt-rent',     label: '아파트 전월세',   iconImg: 'apt',     deal: 'rent' },
  { type: 'offitel-sale', label: '오피스텔 매매',   iconImg: 'offitel', deal: 'sale' },
  { type: 'offitel-rent', label: '오피스텔 전월세', iconImg: 'offitel', deal: 'rent' },
  { type: 'villa-sale',   label: '빌라 매매',       iconImg: 'villa',   deal: 'sale' },
  { type: 'villa-rent',   label: '빌라 전월세',     iconImg: 'villa',   deal: 'rent' },
]

function countOf(t: HubType): number | null {
  const entry = props.summaries?.[t]
  if (!entry) return null
  return entry.last30dCount
}

const formatter = new Intl.NumberFormat('ko-KR')
function formatCount(n: number): string {
  return formatter.format(n)
}
</script>
