<template>
  <section class="home-rising-regions" aria-labelledby="home-rising-heading">
    <div class="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 id="home-rising-heading" class="text-xl md:text-2xl font-extrabold tracking-tight text-strong">
          요즘 거래가 늘어난 지역
        </h2>
        <p v-if="periodLabel" class="mt-2 text-sm text-muted">{{ periodLabel }}</p>
      </div>
      <div
        v-if="data && !error"
        role="group"
        aria-label="지역 범위"
        class="ui-segmented self-start"
      >
        <button
          v-for="tab in TABS"
          :key="tab.value"
          type="button"
          class="ui-segmented__item min-h-[44px]"
          :class="{ 'ui-segmented__item--selected': scope === tab.value }"
          :aria-pressed="scope === tab.value ? 'true' : 'false'"
          @click="onTab(tab.value)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <p v-if="pending" class="mt-4 text-sm font-semibold text-strong" aria-live="polite">불러오는 중입니다.</p>

    <template v-else-if="data && !error">
      <p v-if="data.items.length === 0" class="mt-4 rounded-xl bg-background-light px-4 py-6 text-sm text-muted">
        이 기간 거래가 늘어난 지역이 없습니다
      </p>
      <template v-else>
        <ol class="mt-4 divide-y divide-line border-y border-line">
          <li
            v-for="(item, index) in data.items"
            :key="`${item.citySlug}-${item.districtSlug}`"
            data-rising-item
            :class="index >= MOBILE_VISIBLE && !expanded ? 'hidden md:block' : ''"
          >
            <HardLink
              :to="`/real-estate/apt-sale/${item.citySlug}/${item.districtSlug}`"
              class="flex min-h-[44px] items-center justify-between gap-3 py-3 text-sm hover:text-primary transition-colors"
            >
              <span class="flex min-w-0 items-center gap-3">
                <span class="w-5 shrink-0 text-center font-bold text-muted tabular-nums">{{ index + 1 }}</span>
                <span class="min-w-0">
                  <span class="block truncate font-bold text-strong">{{ item.label }}</span>
                  <span v-if="item.ppMedian !== null" class="block text-xs text-muted tabular-nums">
                    평당가 {{ item.ppMedian.toLocaleString('ko-KR') }}만
                  </span>
                </span>
              </span>
              <span class="shrink-0 font-extrabold text-delta-up tabular-nums">{{ formatChange(item.changePct) }}</span>
            </HardLink>
          </li>
        </ol>
        <button
          v-if="data.items.length > MOBILE_VISIBLE && !expanded"
          type="button"
          data-testid="rising-more"
          class="md:hidden mt-3 w-full min-h-[44px] rounded-lg border border-line bg-white text-sm font-bold text-strong hover:border-primary hover:text-primary transition-colors"
          @click="expanded = true"
        >
          10위까지 더 보기
        </button>
      </template>
    </template>

    <p class="mt-3 text-xs text-muted">국토교통부 아파트 매매 실거래가 · 직거래·취소 제외 · 일상킷 집계</p>

    <nav class="mt-4" aria-label="시·도별 바로가기">
      <p class="sr-only">시·도별 바로가기</p>
      <div class="flex flex-wrap gap-2">
        <HardLink
          v-for="city in CITY_LINKS"
          :key="city.slug"
          :to="`/${city.slug}/`"
          class="ui-chip"
        >
          {{ city.label }}
        </HardLink>
      </div>
    </nav>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { useRisingRegions } from '~/composables/useRisingRegions'
import type { RisingScope } from '~/types/housingRedesign'
import { CITY_LINKS } from '~/utils/seoConstants'

const TABS: { value: RisingScope; label: string }[] = [
  { value: 'all', label: '전국' },
  { value: 'capital', label: '수도권' },
  { value: 'nonCapital', label: '지방' },
]
const MOBILE_VISIBLE = 5

const { scope, data, pending, error, setScope } = useRisingRegions()
const expanded = ref(false)

watch(scope, () => {
  expanded.value = false
})

function onTab(next: RisingScope) {
  if (next !== scope.value) setScope(next)
}

function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-')
  return `${Number(month)}월 ${Number(day)}일`
}

const periodLabel = computed(() => {
  const window = data.value?.window
  if (!window || error.value) return ''
  return `${formatMonthDay(window.from)}~${formatMonthDay(window.to)} 계약, 직전 30일 대비`
})

// 정수는 그대로, 소수는 한 자리까지(예: +34%, +12.5%)
function formatChange(pct: number): string {
  return `${pct > 0 ? '+' : ''}${Number(pct.toFixed(1))}%`
}
</script>
