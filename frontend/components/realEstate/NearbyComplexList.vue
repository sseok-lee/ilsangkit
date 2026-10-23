<template>
  <SectionBlock variant="flat">
    <template #heading>
      <h3 class="ui-h2 text-strong">{{ heading }}</h3>
      <p class="mt-[7px] text-muted text-[13px] md:text-sm">{{ description }}</p>
    </template>

    <div
      v-if="tabs.length > 1"
      role="tablist"
      aria-label="주변 단지 유형"
      class="flex gap-1.5 mb-3"
    >
      <button
        v-for="tab in tabs"
        :id="`nearby-tab-${tab.key}`"
        :key="tab.key"
        type="button"
        role="tab"
        :aria-selected="tab.key === activeKey ? 'true' : 'false'"
        :aria-controls="`nearby-panel-${tab.key}`"
        :tabindex="tab.key === activeKey ? 0 : -1"
        :class="[
          'min-h-[36px] px-3 rounded-full border text-[13px] font-bold transition-colors duration-200',
          tab.key === activeKey
            ? 'border-primary bg-primary-50 text-primary-700'
            : 'border-line bg-white text-muted hover:text-strong',
        ]"
        @click="selected = tab.key"
      >
        {{ tab.label }} {{ tab.items.length }}
      </button>
    </div>

    <!-- 모든 패널을 SSR HTML 에 렌더하고 비활성 패널은 v-show 로만 숨긴다(크롤러가 내부 링크를 본다). -->
    <div
      v-for="tab in tabs"
      v-show="tab.key === activeKey"
      :id="`nearby-panel-${tab.key}`"
      :key="tab.key"
      role="tabpanel"
      :aria-labelledby="tabs.length > 1 ? `nearby-tab-${tab.key}` : undefined"
      :aria-label="tabs.length > 1 ? undefined : heading"
    >
      <ul class="grid grid-cols-1 md:grid-cols-2 md:gap-x-8 border-t border-line">
        <li
          v-for="row in tab.rows"
          :key="row.key"
          class="border-b border-line"
          data-testid="nearby-row"
        >
          <HardLink
            :to="row.url"
            class="flex items-start justify-between gap-3 min-h-[44px] py-3 hover:bg-primary-50/40 transition-colors duration-200"
          >
            <span class="flex-1 min-w-0">
              <span class="block font-bold text-strong text-[15px] truncate">{{ row.name }}</span>
              <span v-if="row.meta" class="block mt-0.5 text-xs text-muted">{{ row.meta }}</span>
            </span>
            <span class="max-w-[62%] text-right break-keep">
              <template v-if="row.price">
                <span class="block font-bold text-strong text-[15px] tabular-nums">{{ row.price }}</span>
                <span v-if="row.areaLine" class="block mt-0.5 text-xs text-muted tabular-nums">{{ row.areaLine }}</span>
                <span v-if="row.perPyeong" class="block text-xs text-faint tabular-nums">{{ row.perPyeong }}</span>
              </template>
              <span v-else class="block text-[13px] text-faint">최근 3년 거래 없음</span>
            </span>
          </HardLink>
        </li>
      </ul>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
      <span class="text-faint">최근 3년 국토교통부 실거래</span>
      <NuxtLink
        :to="listUrl"
        class="inline-flex items-center min-h-[44px] font-bold text-primary hover:underline"
        data-testid="nearby-list-link"
      >
        {{ districtName }} {{ activeTab?.label ?? '' }} 전체 보기 →
      </NuxtLink>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { NearbyComplexItem, NearbyResponse, RealEstatePropertyType } from '~/types/realEstate'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { formatKoreanPrice, formatWolsePrice } from '~/utils/formatters'

interface Props {
  nearby: NearbyResponse
  /** 현재 상세 페이지 유형 */
  currentProperty: RealEstatePropertyType
  mode: 'sale' | 'rent'
  rentType: 'all' | 'jeonse' | 'wolse'
  dongName?: string | null
  districtName: string
  citySlug: string
  districtSlug: string
}
const props = defineProps<Props>()

const PROPERTY_ORDER: Array<{ key: RealEstatePropertyType; label: string }> = [
  { key: 'apt', label: '아파트' },
  { key: 'offitel', label: '오피스텔' },
  { key: 'villa', label: '빌라' },
]

/** 평당가 = 가격 ÷ (전용면적 ÷ 3.3058), 만원 단위 반올림 */
const PYEONG_M2 = 3.3058

const dealWord = computed(() => {
  if (props.mode === 'sale') return '매매'
  if (props.rentType === 'jeonse') return '전세'
  if (props.rentType === 'wolse') return '월세'
  return '전월세'
})

function shortDate(date: string): string {
  return date.slice(2).replaceAll('-', '.')
}

function rowOf(item: NearbyComplexItem, property: RealEstatePropertyType, sameTab: boolean) {
  const meta = [
    item.buildYear ? `${item.buildYear}년 준공` : null,
    item.recentCount3y !== undefined ? `3년 거래 ${item.recentCount3y.toLocaleString()}건` : null,
  ].filter(Boolean).join(' · ')

  const deal = item.areaDeal
  let price: string | null = null
  let areaLine: string | null = null
  let perPyeong: string | null = null
  if (deal) {
    const wolse = deal.monthlyRent !== null && deal.monthlyRent > 0
    price = wolse ? formatWolsePrice(deal.price, deal.monthlyRent as number) : formatKoreanPrice(deal.price)
    const area = `${deal.areaLabel}㎡${sameTab && deal.isRepresentative ? '(대표 면적)' : ''}`
    areaLine = [area, shortDate(deal.date), deal.floor !== null ? `${deal.floor}층` : null].filter(Boolean).join(' · ')
    if (!wolse && deal.exclusiveArea > 0) {
      perPyeong = `평당 ${formatKoreanPrice(Math.round(deal.price / (deal.exclusiveArea / PYEONG_M2)))}`
    }
  } else if (deal === undefined && item.latestPrice !== null) {
    // 구 응답(캐시): 새 필드가 없으면 기존 최근가만 보여 준다.
    price = item.monthlyRent && item.monthlyRent > 0
      ? formatWolsePrice(item.latestPrice, item.monthlyRent)
      : formatKoreanPrice(item.latestPrice)
  }

  return {
    key: item.buildingKey ?? `${property}-${item.buildingName}-${item.bjdCode}-${item.dongName}-${item.jibun ?? ''}`,
    name: item.buildingName,
    meta,
    price,
    areaLine,
    perPyeong,
    url: toRealEstateUrl({
      type: `${property}-${props.mode}` as RealEstateUrlType,
      city: item.city,
      district: item.district,
      buildingName: item.buildingName,
      buildingKey: item.buildingKey,
      canonicalPath: item.canonicalPath,
    }),
  }
}

const tabs = computed(() =>
  PROPERTY_ORDER
    .map(({ key, label }) => {
      const items = props.nearby[key] ?? []
      const sameTab = key === props.currentProperty
      return { key, label, items, rows: items.map((item) => rowOf(item, key, sameTab)) }
    })
    .filter((tab) => tab.items.length > 0),
)

const selected = ref<RealEstatePropertyType | null>(null)
const activeKey = computed<RealEstatePropertyType | null>(() => {
  const keys = tabs.value.map((tab) => tab.key)
  if (selected.value && keys.includes(selected.value)) return selected.value
  if (keys.includes(props.currentProperty)) return props.currentProperty
  return keys[0] ?? null
})
const activeTab = computed(() => tabs.value.find((tab) => tab.key === activeKey.value) ?? null)

const heading = computed(() => {
  const label = activeTab.value?.label ?? ''
  if (props.mode === 'sale') return `주변 ${label} 매매가`
  if (props.rentType === 'jeonse') return `주변 ${label} 전세가`
  if (props.rentType === 'wolse') return `주변 ${label} 월세가`
  return `주변 ${label} 전월세`
})

const description = computed(() => {
  const dong = props.dongName?.trim() || '동네'
  const target = props.nearby.targetArea
  if (activeKey.value === props.currentProperty && target) {
    const pyeongNote = props.rentType === 'wolse' ? '' : ' 평당가는 전용면적 기준입니다.'
    return `같은 ${dong} 단지의 ${target.label}㎡ 최근 ${dealWord.value}가입니다.${pyeongNote}`
  }
  return `같은 ${dong} ${activeTab.value?.label ?? ''} 단지의 대표 면적 최근 ${dealWord.value}가입니다.`
})

const listUrl = computed(() =>
  `/real-estate/${activeKey.value ?? props.currentProperty}-${props.mode}/${props.citySlug}/${props.districtSlug}`,
)
</script>
