<template>
  <section class="home-market-section" aria-labelledby="home-market-heading">
    <div class="rounded-2xl bg-background-light px-5 py-5 md:px-7 md:py-6">
      <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 id="home-market-heading" class="text-xl md:text-2xl font-extrabold tracking-tight text-strong">
            지금, 우리 동네 거래는
          </h2>
          <p class="mt-2 text-sm text-muted">
            {{ regionLabel }} · 아파트 · 빌라 · 오피스텔 거래 건수 기준
          </p>
          <dl class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <div class="flex gap-1">
              <dt class="font-semibold text-strong">기간</dt>
              <dd>{{ windowRangeLabel }}</dd>
            </div>
            <div class="flex gap-1">
              <dt class="font-semibold text-strong">조회시각</dt>
              <dd>{{ generatedAtLabel }}</dd>
            </div>
          </dl>
        </div>
        <div class="flex flex-col sm:flex-row md:flex-col gap-2 md:items-end">
          <p class="text-xs font-semibold text-muted">계약일 기준 · 단위 건</p>
          <button
            type="button"
            class="inline-flex items-center justify-center gap-1.5 min-h-[36px] px-3 rounded-lg border border-line bg-white text-sm font-semibold text-strong hover:border-primary hover:text-primary transition-colors"
            @click="refresh"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
            새로고침
          </button>
        </div>
      </div>

      <div class="mt-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <label class="block">
          <span class="sr-only">시도 선택</span>
          <select
            v-model="selectedCity"
            aria-label="시도 선택"
            class="w-full h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-strong focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            @change="onCityChange"
          >
            <option value="">전국</option>
            <option v-for="city in cityOptions" :key="city.slug" :value="city.slug">
              {{ city.label }}
            </option>
          </select>
        </label>
        <label class="block">
          <span class="sr-only">시군구 선택</span>
          <select
            v-model="selectedDistrict"
            aria-label="시군구 선택"
            :disabled="!selectedCity"
            class="w-full h-11 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-strong disabled:bg-white/60 disabled:text-faint focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            @change="onDistrictChange"
          >
            <option value="">전체 시군구</option>
            <option v-for="district in districtOptions" :key="district.slug" :value="district.slug">
              {{ district.label }}
            </option>
          </select>
        </label>
      </div>

      <p class="sr-only" aria-live="polite">{{ liveStatus }}</p>

      <div v-if="pending" class="mt-5 border-t border-line pt-5 text-sm font-semibold text-strong">
        시장 정보를 불러오는 중입니다.
      </div>

      <div v-else-if="error" class="mt-5 border-t border-line pt-5">
        <p class="text-sm font-semibold text-red-700">시장 정보를 불러오지 못했습니다.</p>
        <button type="button" class="mt-3 text-sm font-bold text-primary hover:underline" @click="refresh">
          다시 시도
        </button>
      </div>

      <template v-else-if="data">
        <div class="mt-5 grid grid-cols-1 divide-y divide-line rounded-xl bg-white sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <article
            v-for="item in countCards"
            :key="item.key"
            class="flex items-center justify-between gap-4 px-4 py-4"
          >
            <div>
              <h3 class="text-sm font-semibold text-muted">{{ item.label }} 매매</h3>
              <p v-if="item.status === 'ok'" class="mt-1 text-2xl font-extrabold text-strong tabular-nums">
                {{ item.total.toLocaleString('ko-KR') }}건
              </p>
              <p v-else class="mt-2 text-sm font-semibold text-muted">조회 실패</p>
            </div>
            <div v-if="item.status === 'ok'" class="flex shrink-0 flex-col items-end gap-1">
              <svg
                class="w-20 h-10 text-primary"
                viewBox="0 0 80 40"
                role="img"
                :aria-label="`${item.label} ${windowRangeLabel} 거래 건수 그래프, 단위 건`"
              >
                <polyline
                  :points="sparklinePoints(item.daily)"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="3"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <span class="text-[11px] text-muted">{{ windowRangeLabel }} · 단위 건</span>
            </div>
          </article>
        </div>
      </template>
    </div>

    <div v-if="data" class="mt-7">
      <div class="flex items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <h3 class="text-xl md:text-2xl font-extrabold tracking-tight text-strong">최근 거래가 있는 단지</h3>
          <p class="mt-2 text-sm text-muted">최근 거래 금액과 면적을 함께 확인하세요.</p>
        </div>
        <HardLink to="/real-estate" class="hidden sm:inline-flex text-sm font-bold text-primary hover:underline">
          실거래가 보기
        </HardLink>
      </div>

      <p class="mt-3 text-xs text-muted">{{ marketDisclosure }}</p>
      <div v-if="recentError" class="py-5 text-sm text-muted">
        최근 거래를 불러오지 못했습니다.
      </div>
      <div v-else-if="recentItems.length === 0" class="py-5 text-sm text-muted">
        최근 30일 거래가 없습니다.
      </div>
      <ul v-else class="divide-y divide-line">
        <li v-for="item in recentItems" :key="`${item.type}-${item.transactionId}`">
          <HardLink :to="recentUrl(item)" class="flex items-center justify-between gap-4 py-4 hover:bg-background-light transition-colors">
            <div class="min-w-0 flex items-center gap-3">
              <span class="material-symbols-outlined inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary text-[20px]" aria-hidden="true">apartment</span>
              <span class="min-w-0">
                <span class="block text-sm font-bold text-strong truncate">{{ item.buildingName }}</span>
                <span class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <span class="font-semibold text-primary">{{ propertyTypeLabel(item.type) }}</span>
                  <span aria-hidden="true">·</span>
                  <span>{{ recentAddress(item) }}</span>
                </span>
              </span>
            </div>
            <div class="text-right shrink-0">
              <p class="text-lg md:text-xl font-extrabold text-strong tabular-nums">{{ formatKoreanPrice(item.amount) }}</p>
              <p class="text-xs text-muted mt-1">{{ item.area ?? '면적 미제공' }} · {{ formatDate(item.date) }} 계약</p>
            </div>
          </HardLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { useHomeMarket } from '~/composables/useHomeMarket'
import type { MarketCount, PropertyType, RecentBuilding } from '~/types/housingRedesign'
import { CITY_SLUGS, CITY_SLUG_MAP, DISTRICT_SLUG_MAP, REGIONS } from '~/shared/regionSlugs'
import { formatKoreanPrice } from '~/utils/formatters'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'

const { region, data, pending, error, setRegion, refresh } = useHomeMarket()

const cityOptions = Object.keys(REGIONS).map((label) => ({
  label,
  slug: CITY_SLUGS[label] ?? label,
}))

const selectedCity = ref(region.value.city ?? '')
const selectedDistrict = ref(region.value.district ?? '')

const districtOptions = computed(() => {
  const cityLabel = selectedCity.value ? CITY_SLUG_MAP[selectedCity.value] : null
  return cityLabel
    ? (REGIONS[cityLabel] ?? []).map((label) => ({ label, slug: DISTRICT_SLUG_MAP[label] ?? label }))
    : []
})

const regionLabel = computed(() => data.value?.region.label ?? selectedRegionLabel.value)
const selectedRegionLabel = computed(() => {
  const city = selectedCity.value ? CITY_SLUG_MAP[selectedCity.value] : null
  if (!city) return '전국'
  const district = districtOptions.value.find((item) => item.slug === selectedDistrict.value)?.label
  return district ? `${city} ${district}` : city
})

const liveStatus = computed(() => `${selectedRegionLabel.value} 지역 시장 정보${pending.value ? '를 불러오는 중입니다.' : '입니다.'}`)
const windowRangeLabel = computed(() => {
  const window = data.value?.window
  return window ? `${formatDate(window.from)}~${formatDate(window.to)}` : '최근 30일'
})
const generatedAtLabel = computed(() => formatKstDateTime(data.value?.generatedAt))
const marketDisclosure = '계약일 기준 · 추가 신고에 따라 수치가 달라질 수 있습니다.'

const countCards = computed(() => {
  const counts = data.value?.counts
  return ([
    ['apt', '아파트'],
    ['villa', '빌라'],
    ['offitel', '오피스텔'],
  ] as const).map(([key, label]) => {
    const result = counts?.[key]
    return result?.status === 'ok'
      ? { key, label, status: 'ok' as const, total: result.data.total, daily: result.data.daily }
      : { key, label, status: 'error' as const, total: 0, daily: [] as MarketCount['daily'] }
  })
})

const recentError = computed(() => data.value?.recent.status === 'error')
const recentItems = computed(() => {
  const recent = data.value?.recent
  return recent?.status === 'ok' ? recent.data.slice(0, 5) : []
})

watch(
  region,
  (next) => {
    selectedCity.value = next.city ?? ''
    selectedDistrict.value = next.district ?? ''
  },
  { deep: true }
)

function onCityChange() {
  selectedDistrict.value = ''
  setRegion(selectedCity.value || null, null)
}

function onDistrictChange() {
  setRegion(selectedCity.value || null, selectedDistrict.value || null)
}

function sparklinePoints(daily: MarketCount['daily']): string {
  const points = daily.length > 0 ? daily : [{ date: '', count: 0 }]
  const max = Math.max(1, ...points.map((item) => item.count))
  return points.map((item, index) => {
    const x = points.length === 1 ? 40 : (index / (points.length - 1)) * 72 + 4
    const y = 36 - (item.count / max) * 30
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function propertyTypeLabel(type: PropertyType): string {
  if (type === 'apt') return '아파트'
  if (type === 'villa') return '빌라'
  return '오피스텔'
}

function typeToUrlType(type: PropertyType): RealEstateUrlType {
  if (type === 'apt') return 'apt-sale'
  if (type === 'villa') return 'villa-sale'
  return 'offitel-sale'
}

function recentUrl(item: RecentBuilding): string {
  return toRealEstateUrl({
    type: typeToUrlType(item.type),
    city: item.city,
    district: item.district,
    buildingName: item.buildingName,
    buildingKey: item.buildingKey,
    canonicalPath: item.canonicalPath,
  })
}

function recentAddress(item: RecentBuilding): string {
  return [item.city, item.district, item.dongName, item.jibun].filter(Boolean).join(' ')
}

function formatDate(date: string): string {
  return date.replaceAll('-', '.')
}

function formatKstDateTime(value: string | undefined): string {
  if (!value) return '조회 전'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '조회 전'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

const itemListSchema = computed(() => {
  if (!data.value || data.value.recent.status !== 'ok' || recentItems.value.length === 0) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${data.value.region.label} 최근 실거래 단지`,
    description: `${data.value.region.label} 최근 30일 실거래 단지 5개`,
    itemListElement: recentItems.value.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.buildingName,
      url: recentUrl(item),
    })),
  }
})

useHead(() => ({
  script: itemListSchema.value
    ? [
        {
          key: 'jsonld-home-market-recent',
          type: 'application/ld+json',
          innerHTML: JSON.stringify(itemListSchema.value),
        },
      ]
    : [],
}))
</script>
