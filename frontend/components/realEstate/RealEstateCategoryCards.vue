<template>
  <div class="grid grid-cols-2 gap-3 md:gap-4">
    <HardLink
      v-for="card in cards"
      :key="card.type"
      :to="`/real-estate/${card.type}`"
      data-test="hub-card"
      class="group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div class="flex items-center gap-2">
        <div
          class="flex size-9 md:size-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors"
        >
          <img
            :src="`/icons/category/${card.iconImg}.webp?v2`"
            :alt="card.label"
            class="w-6 h-6 md:w-7 md:h-7"
            width="28"
            height="28"
          />
        </div>
        <span
          data-test="hub-card-badge"
          :class="[
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
            card.deal === 'sale'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-amber-100 text-amber-700',
          ]"
        >
          {{ card.deal === 'sale' ? '매매' : '전월세' }}
        </span>
      </div>
      <p class="text-sm md:text-base font-semibold text-slate-800 group-hover:text-primary transition-colors leading-tight">
        {{ card.label }}
      </p>
      <p
        v-if="card.count !== null"
        class="text-xs md:text-sm text-slate-700 tabular-nums"
      >
        이번달 · 지난달 <span class="font-bold text-slate-900">{{ card.countText }}</span>건
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
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import type { RealEstateHubType } from '~/types/realEstate'

type HubType = RealEstateHubType

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

const formatter = new Intl.NumberFormat('ko-KR')

const cards = computed(() =>
  CARD_ORDER.map((entry) => {
    const e = props.summaries?.[entry.type]
    const count = e ? e.last30dCount : null
    return {
      ...entry,
      count,
      countText: count !== null ? formatter.format(count) : null,
    }
  }),
)
</script>
