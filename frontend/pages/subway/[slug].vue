<template>
  <div class="min-h-screen bg-background-light flex flex-col text-strong">
    <main class="flex-1 w-full">
      <!-- Loading -->
      <div v-if="pending" class="flex items-center justify-center py-20 min-h-[400px]" role="status" aria-label="정보 로딩 중">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p class="text-gray-600">{{ UI_MESSAGES.loading }}</p>
        </div>
      </div>

      <!-- Error -->
      <div v-else-if="error || !station" class="max-w-lg mx-auto px-4 py-20 text-center">
        <span class="material-symbols-outlined text-[64px] text-red-500 mb-4">error</span>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">지하철역 정보를 불러올 수 없습니다</h2>
        <NuxtLink to="/subway" class="inline-block mt-4 px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors">
          지하철역 목록으로
        </NuxtLink>
      </div>

      <template v-else>
        <!-- Fullscreen Map Overlay (Mobile) -->
        <Teleport to="body">
          <Transition
            enter-active-class="transition-opacity duration-200"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <div v-if="isMapExpanded" class="md:hidden fixed inset-0 z-[60] bg-background-light">
              <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-white/80 to-transparent">
                <button class="flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm" @click="isMapExpanded = false">
                  <span class="material-symbols-outlined text-strong">close</span>
                </button>
                <span class="text-sm font-bold text-strong bg-white/90 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm truncate max-w-[60vw]">{{ displayName }}</span>
                <a
                  :href="kakaoMapUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-sm"
                >
                  <span class="material-symbols-outlined text-[20px]">directions</span>
                </a>
              </div>
              <ClientOnly>
                <FacilityMap
                  :center="{ lat: station.lat, lng: station.lng }"
                  :facilities="[mapFacility]"
                  :level="3"
                  class="w-full h-full"
                />
              </ClientOnly>
            </div>
          </Transition>
        </Teleport>

        <!-- Body -->
        <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-3 md:pt-5 pb-10">
          <div class="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-4 lg:gap-6 lg:items-start">
            <article class="flex flex-col gap-4 md:gap-5 w-full min-w-0">
              <!-- Breadcrumb + Share -->
              <div class="flex items-center justify-between gap-2">
                <Breadcrumb :items="breadcrumbItems" />
                <button
                  class="flex shrink-0 items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg border border-line text-muted hover:text-primary hover:border-primary transition-colors text-sm"
                  aria-label="이 지하철역 공유하기"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined text-[16px]">share</span>
                  <span class="hidden sm:inline">공유</span>
                </button>
              </div>

              <!-- Hero: 모바일 핵심 정보 헤더 / 데스크톱 PageHero -->
              <MobileDetailHeader
                :title="displayName"
                eyebrow="지하철역"
                :stats="heroStats"
                :phone="station.phoneNumber"
                copyable
                :kakao-map-url="kakaoMapUrl"
                :naver-map-url="naverMapUrl"
                @share="handleShare"
                @copy="copyStationAddress"
                @directions="openDirections"
              />
              <PageHero
                class="hidden md:block"
                title-tag="div"
                eyebrow="지하철역"
                :title="displayName"
                :description="introText"
                :stats="heroStats"
              />

              <AdBanner />

              <!-- Basic Info -->
              <SectionBlock heading="역정보" subtext="위치·운영기관·연락처 정보">
                <!-- 노선 headline (대표 정보 1순위) -->
                <div v-if="lines.length > 0" data-test="line-headline" class="mb-4 flex flex-wrap gap-2">
                  <span
                    v-for="ln in lines"
                    :key="ln"
                    class="inline-flex items-center text-sm font-bold px-3.5 py-1.5 rounded-full text-white shadow-sm"
                    :style="{ backgroundColor: lineColor(ln) }"
                  >
                    {{ lineLabel(ln) }}
                  </span>
                </div>

                <dl class="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
                  <div v-if="station.roadAddress || station.address" class="sm:col-span-2">
                    <dt class="text-xs font-medium text-muted mb-1">주소</dt>
                    <dd class="text-sm text-strong">{{ station.roadAddress || station.address }}</dd>
                  </div>

                  <div v-if="station.operator">
                    <dt class="text-xs font-medium text-muted mb-1">운영기관</dt>
                    <dd class="text-sm text-strong">{{ station.operator }}</dd>
                  </div>

                  <div v-if="station.phoneNumber">
                    <dt class="text-xs font-medium text-muted mb-1">전화번호</dt>
                    <dd class="text-sm text-strong">
                      <a :href="`tel:${station.phoneNumber}`" class="hover:text-primary hover:underline">{{ station.phoneNumber }}</a>
                    </dd>
                  </div>
                </dl>
              </SectionBlock>

              <AdBanner />

              <!-- 위치·로드뷰 -->
              <SectionBlock heading="위치·로드뷰" subtext="지도와 로드뷰로 역 주변을 확인하세요.">
                <!-- 모바일 전용 라이브 지도 (데스크톱은 사이드바 지도 사용) -->
                <div class="md:hidden relative h-[220px] w-full rounded-xl overflow-hidden border border-line mb-3">
                  <ClientOnly>
                    <FacilityMap
                      :center="{ lat: station.lat, lng: station.lng }"
                      :facilities="[mapFacility]"
                      :level="3"
                      class="w-full h-full !min-h-0"
                    />
                  </ClientOnly>
                  <button
                    class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-ink px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
                    @click="isMapExpanded = true"
                  >
                    <span class="material-symbols-outlined text-[16px]">open_in_full</span>
                    지도 크게 보기
                  </button>
                </div>
                <div class="h-[220px]">
                  <FacilityRoadview :lat="station.lat" :lng="station.lng" />
                </div>
              </SectionBlock>

              <AdBanner />

              <!-- 주변 시설 (다른 지하철역 + 주차장·EV충전·화장실·시장) -->
              <DetailNearby
                :nearby-facilities="nearbyStations"
                :nearby-loading="nearbyLoading"
                :cross-facilities-grouped="crossFacilitiesGrouped"
                :cross-loading="crossLoading"
                :category-meta="categoryMetaForNearby"
              />

              <AdBanner />

              <!-- 관련 탐색 -->
              <SectionBlock heading="관련 탐색" subtext="비슷한 카테고리나 인기 지역으로 탐색을 이어가세요.">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="text-xs text-muted font-medium pr-1">관련 카테고리</span>
                  <NuxtLink
                    v-for="cat in relatedCategories"
                    :key="cat.slug"
                    :to="`/${cat.slug}`"
                    class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-ink hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  >
                    {{ cat.label }}
                  </NuxtLink>
                </div>
                <div v-if="regionLink" class="flex flex-wrap items-center gap-2 mt-3">
                  <span class="text-xs text-muted font-medium pr-1">지역</span>
                  <NuxtLink
                    :to="regionLink.href"
                    class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-ink hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  >
                    {{ regionLink.label }}
                  </NuxtLink>
                </div>
              </SectionBlock>

              <!-- FAQ -->
              <SectionBlock v-if="faqItems.length > 0" heading="자주 묻는 질문">
                <div class="space-y-1">
                  <details v-for="(faq, i) in faqItems" :key="i" class="border-b border-line last:border-b-0">
                    <summary class="py-3 cursor-pointer font-medium text-ink hover:text-primary">{{ faq.question }}</summary>
                    <p class="pb-3 text-muted text-sm leading-relaxed">{{ faq.answer }}</p>
                  </details>
                </div>
              </SectionBlock>

              <!-- Mobile inline CoupangBanner -->
              <!-- 고지문은 모바일/데스크톱 두 CoupangBanner 인스턴스에서 끄고(disclosure=false) 아래
                   단일 <p>로 페이지당 1회만 노출한다(모든 뷰포트, 반대 브레이크포인트에서 광고만 있고
                   고지 누락되는 사고 방지 — 절대 md:hidden/hidden md:flex 금지). -->
              <CoupangBanner class="md:hidden" :disclosure="false" />
              <p class="mt-2 text-center text-[11px] leading-relaxed text-slate-400">{{ COUPANG_DISCLOSURE }}</p>

              <!-- Data Source -->
              <DataSourceSection domain="facility" category="subway" :last-sync-date="station?.updatedAt ? formatKstDate(station.updatedAt) : null" />
            </article>

            <!-- Sidebar -->
            <aside class="hidden md:flex lg:sticky lg:top-24 w-full flex-col">
              <!-- Map -->
              <div class="relative w-full aspect-square bg-[#e5e7eb] h-full rounded-xl overflow-hidden shadow-md min-h-[300px]" role="img" aria-label="지하철역 위치 지도">
                <ClientOnly>
                  <FacilityMap
                    :center="{ lat: station.lat, lng: station.lng }"
                    :facilities="[mapFacility]"
                    :level="3"
                    class="w-full h-full opacity-80"
                  />
                </ClientOnly>
              </div>

              <!-- Actions -->
              <div class="mt-3 p-4 bg-white border border-line-2 flex gap-3 shadow-card rounded-xl">
                <a
                  v-if="station.phoneNumber"
                  data-test="sidebar-call"
                  :href="`tel:${station.phoneNumber}`"
                  class="flex-1 h-12 rounded-xl bg-background-light text-strong font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200"
                  aria-label="전화 걸기"
                >
                  <span class="material-symbols-outlined">call</span>
                  전화
                </a>
                <button
                  class="flex-1 h-12 rounded-xl bg-background-light text-strong font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200"
                  aria-label="공유하기"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined">share</span>
                  공유하기
                </button>
                <div class="relative flex-[2]">
                  <button
                    class="w-full h-12 rounded-xl bg-primary text-white font-bold text-base hover:bg-primary-dark transition-colors shadow-lg shadow-primary-500/30 flex items-center justify-center gap-2"
                    @click="showNavDropdown = !showNavDropdown"
                  >
                    <span class="material-symbols-outlined">directions</span>
                    길찾기
                    <span class="material-symbols-outlined text-[18px]">expand_more</span>
                  </button>
                  <div v-if="showNavDropdown" class="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-line-2 overflow-hidden z-20">
                    <a :href="kakaoMapUrl" target="_blank" rel="noopener noreferrer" class="w-full px-4 py-3 text-left text-sm font-medium text-strong hover:bg-gray-50 flex items-center gap-3 transition-colors">
                      <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                    </a>
                    <div class="h-px bg-background-light"></div>
                    <a :href="naverMapUrl" target="_blank" rel="noopener noreferrer" class="w-full px-4 py-3 text-left text-sm font-medium text-strong hover:bg-gray-50 flex items-center gap-3 transition-colors">
                      <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
                    </a>
                  </div>
                </div>
              </div>

              <!-- 고지문은 모바일 인라인 배너 옆 단일 <p>로 통합됐으므로 여기선 끔 -->
              <CoupangBanner class="mt-3" :disclosure="false" />

              <div class="mt-3">
                <AdBanner />
              </div>
            </aside>
          </div>
        </div>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import { UI_MESSAGES } from '~/utils/uiMessages'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import CoupangBanner, { COUPANG_DISCLOSURE } from '~/components/ads/CoupangBanner.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import FacilityRoadview from '~/components/facility/FacilityRoadview.vue'
import DetailNearby from '~/components/facility/detail/DetailNearby.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import { lineColor, lineLabel, dedupeLines } from '~/utils/subwayLineColors'
import { useSubwayStation } from '~/composables/useSubwayStation'
import { buildSubwayDescription, buildSubwayJsonLd, buildSubwayTitle } from '~/utils/subwayMeta'
import { formatKstDate } from '~/utils/formatters'
import { subwayCanonicalUrl } from '~/utils/subwayCanonical'
import { SITE_URL, RELATED_CATEGORIES } from '~/utils/seoConstants'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { CATEGORY_META } from '~/types/facility'
import type { Facility, FacilityCategory } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { useStructuredData } from '~/composables/useStructuredData'

const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const route = useRoute()
const slug = computed(() => String(route.params.slug ?? ''))

const { data, error, pending } = await useSubwayStation(slug.value)

if ((error.value || !data.value?.data) && !pending.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Station not found',
    fatal: true,
  })
}

const station = computed(() => data.value?.data ?? null)
// CSV에 "가산디지털단지" / "가산디지털단지역" 같이 끝 "역" 유무가 혼재되어 있어
// 표시할 때는 항상 "역" 1개를 보장 (이중 "역역" 방지).
function withStationSuffix(name: string): string {
  const base = name.replace(/역$/, '').trim()
  return base ? `${base}역` : ''
}
const displayName = computed(() => (station.value ? withStationSuffix(station.value.name) : ''))

// 노선 합집합 (주 노선 + 환승)
const lines = computed(() => {
  if (!station.value) return []
  const all = [station.value.line, ...(station.value.transferLines ?? [])].filter(Boolean) as string[]
  return dedupeLines(all)
})

// 지도/공유용 facility-shape 매핑
const mapFacility = computed<Facility>(() => ({
  id: station.value?.nameSlug ?? '',
  name: displayName.value,
  category: 'subway',
  address: station.value?.address ?? null,
  roadAddress: station.value?.roadAddress ?? null,
  lat: station.value?.lat ?? 0,
  lng: station.value?.lng ?? 0,
  city: station.value?.city ?? '',
  district: station.value?.district ?? '',
}))

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/' },
  { label: '지하철역', href: '/subway' },
  { label: displayName.value, current: true },
])

const introText = computed(() => {
  if (!station.value) return undefined
  const loc = [station.value.city, station.value.district].filter(Boolean).join(' ')
  return `${displayName.value}은 ${loc}에 위치한 지하철역입니다.`
})

const heroStats = computed(() => {
  if (lines.value.length === 0) return []
  return [{ label: '노선', value: `${lines.value.length}개` }]
})

const relatedCategories = computed(() => {
  const related = RELATED_CATEGORIES['subway'] || []
  return related.map((c) => ({ slug: c, label: CATEGORY_META[c as FacilityCategory]?.label ?? c }))
})

const regionLink = computed(() => {
  if (!station.value?.regionSlug || !station.value?.district) return null
  return {
    href: `/${station.value.regionSlug}`,
    label: `${station.value.city} 전체보기`,
  }
})

const faqItems = computed(() => CATEGORY_FAQ.subway ?? [])

const categoryMetaForNearby = computed(() => ({
  label: CATEGORY_META.subway.label,
  icon: CATEGORY_META.subway.icon,
}))

// 주변 시설 데이터
const CROSS_CATEGORIES = ['parking', 'ev-charger', 'toilet', 'market'] as const
const NEARBY_RADIUS = 1000

const nearbyStations = ref<Facility[]>([])
const nearbyLoading = ref(false)
const crossFacilitiesGrouped = ref<Array<{ category: FacilityCategory; meta: { label: string; icon?: string }; items: Facility[] }>>([])
const crossLoading = ref(false)
const apiBase = useApiBase()

async function fetchNearbyStations() {
  if (!station.value) return
  nearbyLoading.value = true
  try {
    // 같은 역의 노선별 row가 분리되어 올 수 있으므로 충분히 가져온 뒤 역명 기준 그룹핑한다.
    const res = await $fetch<{ success: boolean; data: { items: Array<{ id: string; name: string; nameSlug: string; line: string; lat?: number; lng?: number; distance: number }> } }>(
      `${apiBase}/api/subway/stations/nearby`,
      {
        query: {
          lat: station.value.lat,
          lng: station.value.lng,
          radius: NEARBY_RADIUS,
          limit: 30,
        },
      },
    )
    if (!res.success || !res.data) return

    // 역명 끝의 "역" 접미사가 CSV에 일관되지 않게 들어있어 정규화 후 비교/그룹핑
    const normalize = (n: string) => n.replace(/역$/, '').trim()
    const currentName = normalize(station.value.name)
    const groups = new Map<string, { primary: typeof res.data.items[number]; lines: Set<string> }>()
    for (const item of res.data.items) {
      const key = normalize(item.name)
      if (key === currentName) continue // 본인 제외
      const existing = groups.get(key)
      if (!existing) {
        groups.set(key, { primary: item, lines: new Set([item.line]) })
      } else {
        existing.lines.add(item.line)
        if (item.distance < existing.primary.distance) existing.primary = item
      }
    }

    nearbyStations.value = Array.from(groups.values())
      .sort((a, b) => a.primary.distance - b.primary.distance)
      .slice(0, 6)
      .map<Facility>((g) => ({
        id: g.primary.nameSlug,
        name: withStationSuffix(g.primary.name),
        category: 'subway',
        address: null,
        roadAddress: null,
        lat: g.primary.lat ?? 0,
        lng: g.primary.lng ?? 0,
        city: '',
        district: '',
        distance: g.primary.distance,
        extras: { lines: Array.from(g.lines).sort() },
      }))
  } catch {
    nearbyStations.value = []
  } finally {
    nearbyLoading.value = false
  }
}

async function fetchCrossFacilities() {
  if (!station.value) return
  crossLoading.value = true
  try {
    const results = await Promise.all(
      CROSS_CATEGORIES.map(async (cat) => {
        try {
          const res = await $fetch<{ success: boolean; data: { items: Facility[] } }>(
            `${apiBase}/api/facilities/search`,
            {
              method: 'POST',
              body: {
                category: cat,
                lat: station.value!.lat,
                lng: station.value!.lng,
                radius: NEARBY_RADIUS,
                page: 1,
                limit: 6,
              },
            },
          )
          return res.success && res.data ? { cat, items: res.data.items } : { cat, items: [] }
        } catch {
          return { cat, items: [] as Facility[] }
        }
      }),
    )
    crossFacilitiesGrouped.value = results
      .filter((r) => r.items.length > 0)
      .map((r) => ({
        category: r.cat,
        meta: {
          label: CATEGORY_META[r.cat]?.label ?? r.cat,
          icon: CATEGORY_META[r.cat]?.icon,
        },
        items: r.items,
      }))
  } finally {
    crossLoading.value = false
  }
}

onMounted(() => {
  void fetchNearbyStations()
  void fetchCrossFacilities()
})

// 길찾기 URL
const kakaoMapUrl = computed(() => {
  if (!station.value) return '#'
  return `https://map.kakao.com/link/to/${encodeURIComponent(displayName.value)},${station.value.lat},${station.value.lng}`
})
const naverMapUrl = computed(() => {
  if (!station.value) return '#'
  return `https://map.naver.com/v5/directions/-/-/${station.value.lng},${station.value.lat},${encodeURIComponent(displayName.value)},,,SUBWAY`
})

// UI state
const isMapExpanded = ref(false)
const showNavDropdown = ref(false)

// 모바일 헤더 길찾기 — provider별 외부 지도 열기
function openDirections(provider: 'kakao' | 'naver') {
  const url = provider === 'kakao' ? kakaoMapUrl.value : naverMapUrl.value
  window.open(url, '_blank')
}

// 모바일 헤더 주소 복사
async function copyStationAddress() {
  const address = station.value?.roadAddress || station.value?.address
  if (!address) return
  try {
    await navigator.clipboard.writeText(address)
    alert('주소가 복사되었습니다.')
  } catch (err) {
    console.error('주소 복사 실패:', err)
  }
}

async function handleShare() {
  if (!station.value) return
  const url = `${SITE_URL}/subway/${station.value.nameSlug}`
  const title = displayName.value
  if (typeof navigator !== 'undefined' && 'share' in navigator) {
    try {
      await navigator.share({ title, url })
      return
    } catch {
      // ignore — fallback below
    }
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // noop
    }
  }
}

// SEO
const subwayOgImage = computed(() => {
  const s = station.value
  if (!s?.lat || !s?.lng) return undefined
  const stationLabel = s.name.endsWith('역') ? s.name : `${s.name}역`
  return `${SITE_URL}/og-map?lat=${s.lat}&lng=${s.lng}&label=${encodeURIComponent(stationLabel)}&category=area&title=${encodeURIComponent(s.name)}`
})

const { setMeta } = useFacilityMeta()

setMeta({
  title: buildSubwayTitle(station.value),
  description: buildSubwayDescription(station.value),
  path: `/subway/${slug.value}`,
  image: subwayOgImage.value,
  imageWidth: 1024,
  imageHeight: 536,
  canonical: subwayCanonicalUrl(slug.value),
})

// FAQPage JSON-LD (spec §6 결정4: FAQ 있는 페이지는 스키마 발행 통일)
const { setFAQSchema, setBreadcrumbSchema, setDetailProvenance } = useStructuredData()
setFAQSchema(faqItems.value)

// BreadcrumbList JSON-LD — 화면 Breadcrumb UI와 동일 경로 (마지막 현재 항목은 자기 URL)
setBreadcrumbSchema(
  breadcrumbItems.value.map((b) => ({
    name: b.label,
    url: 'href' in b && b.href ? b.href : `/subway/${slug.value}`,
  })),
)

// 출처 Dataset(provenance) — 국토교통부 도시철도역사 표준데이터
setDetailProvenance({
  domain: 'facility',
  category: 'subway',
  path: `/subway/${slug.value}`,
  description: buildSubwayDescription(station.value),
  updatedAt: station.value?.updatedAt ?? null,
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify(buildSubwayJsonLd(station.value))),
    },
  ],
})
</script>
