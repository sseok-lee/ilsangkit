<template>
  <div class="min-h-screen bg-background-light flex flex-col text-slate-900">
    <!-- Main Content -->
    <main class="flex-1 w-full">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20 min-h-[400px]" role="status" aria-label="정보 로딩 중">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p class="text-gray-600">로딩 중...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="max-w-lg mx-auto px-4 py-20 text-center">
        <span class="material-symbols-outlined text-[64px] text-red-500 mb-4">error</span>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">시설 정보를 불러올 수 없습니다</h2>
        <p class="text-gray-600 mb-6">{{ error.message }}</p>
        <div class="flex items-center justify-center gap-4">
          <NuxtLink
            :to="`/${category}`"
            class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            {{ categoryMeta.label }} 목록으로
          </NuxtLink>
        </div>
      </div>

      <!-- Facility Detail -->
      <template v-else-if="facility">
        <!-- Mobile: Map at top -->
        <div class="md:hidden relative h-[240px] w-full overflow-hidden bg-gray-200">
          <ClientOnly>
            <FacilityMap
              :center="{ lat: facility.lat, lng: facility.lng }"
              :facilities="[facility]"
              :level="3"
              class="w-full h-full !min-h-0 !rounded-none"
            />
          </ClientOnly>

          <!-- Back Button & Name Overlay -->
          <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
            <div class="flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95" @click="handleBack">
              <span class="material-symbols-outlined text-slate-900">arrow_back</span>
            </div>
            <span class="max-w-[calc(100vw-100px)] truncate rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-slate-900 shadow-sm backdrop-blur-sm">{{ displayName }}</span>
          </div>

          <!-- Gradient Overlay at bottom -->
          <div class="absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-background-light to-transparent"></div>

          <!-- Map expand button -->
          <button
            class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
            @click="isMapExpanded = true"
          >
            <span class="material-symbols-outlined text-[16px]">open_in_full</span>
            지도 크게 보기
          </button>

        </div>

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
            <div
              v-if="isMapExpanded && facility"
              class="md:hidden fixed inset-0 z-[60] bg-background-light"
            >
              <!-- Header -->
              <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-white/80 to-transparent">
                <button
                  class="flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm"
                  @click="isMapExpanded = false"
                >
                  <span class="material-symbols-outlined text-slate-700">close</span>
                </button>
                <span class="text-sm font-bold text-slate-900 bg-white/90 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm truncate max-w-[60vw]">{{ displayName }}</span>
                <a
                  :href="`https://map.kakao.com/link/to/${encodeURIComponent(displayName)},${facility.lat},${facility.lng}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-sm"
                >
                  <span class="material-symbols-outlined text-[20px]">directions</span>
                </a>
              </div>
              <!-- Full screen map -->
              <ClientOnly>
                <FacilityMap
                  :center="{ lat: facility.lat, lng: facility.lng }"
                  :facilities="[facility]"
                  :level="3"
                  class="w-full h-full"
                />
              </ClientOnly>
            </div>
          </Transition>
        </Teleport>

        <!-- Unified body: Hero + 본문 + 사이드바를 하나의 grid로 통합 -->
        <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-3 md:pt-5 pb-10">
          <div class="grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-4 lg:gap-6 lg:items-start">
            <article class="flex flex-col gap-4 md:gap-5 w-full min-w-0">
              <!-- Breadcrumb + Share -->
              <div class="flex items-center justify-between gap-2">
                <Breadcrumb :items="desktopBreadcrumbItems" />
                <button
                  class="flex shrink-0 items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg border border-line text-slate-600 hover:text-primary hover:border-primary transition-colors text-sm"
                  aria-label="이 시설 공유하기"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined text-[16px]">share</span>
                  <span class="hidden sm:inline">공유</span>
                </button>
              </div>

              <!-- Hero (H1) -->
              <PageHero
                :eyebrow="categoryMeta.label"
                :title="displayName"
                :description="heroDescription || undefined"
                :stats="heroStats"
                :actions="heroActions"
                @action="handleHeroAction"
              >
                <template v-if="heroBadge" #badge>
                  <OperatingStatusBadge :status="heroBadge" />
                </template>
              </PageHero>

              <!-- Ad: HERO 아래 -->
              <AdBanner />

              <!-- BasicInfo -->
              <DetailBasicInfo
                :facility="facility"
                :hospital-operating-hours="hospitalOperatingHours"
                :hospital-weekly-hours-count="hospitalWeeklyHours.length"
                :aed-operating-hours="aedOperatingHours"
                :aed-weekly-hours-count="aedWeeklyHours.length"
                :pharmacy-operating-hours="pharmacyOperatingHours"
              />

              <!-- FacilityStatus -->
              <DetailFacilityStatus :facility="facility" />

              <!-- Ad: DETAILS ↔ MAP 사이 -->
              <AdBanner />

              <!-- Roadview -->
              <SectionBlock heading="로드뷰" subtext="시설 주변의 거리 뷰를 확인하세요.">
                <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
              </SectionBlock>

              <!-- Ad: ROADVIEW ↔ NEARBY 사이 -->
              <AdBanner />

              <!-- 주변 시설 (same + cross category) -->
              <DetailNearby
                :nearby-facilities="nearbyFiltered"
                :nearby-loading="nearbyLoading"
                :cross-facilities-grouped="crossFacilitiesGrouped"
                :cross-loading="crossLoading"
                :category-meta="categoryMeta"
              />

              <!-- Ad: NEARBY 이후 -->
              <AdBanner />

              <!-- 컨텍스트 링크 (관련 가이드 + 지역 + 팁 + FAQ + 데이터 출처) -->
              <DetailContextLinks
                :category="category"
                :region-link="regionLink"
                :related-categories="relatedCategories"
                :category-meta="categoryMeta"
                :category-tips="categoryTips"
                :category-faq-items="categoryFaqItems"
                :data-source="dataSource"
                :data-date="dataDate"
                :last-sync-date="lastSyncDate"
              />

              <!-- Mobile-only inline CoupangBanner (md+에서는 사이드바 Coupang 사용) -->
              <CoupangBanner class="md:hidden" />
            </article>

            <!-- Desktop/tablet sidebar: Map + Actions + Coupang (md+에서 노출) -->
            <aside class="hidden md:flex lg:sticky lg:top-24 w-full flex-col">
              <!-- Map Container -->
              <div class="relative w-full aspect-square bg-[#e5e7eb] h-full rounded-xl overflow-hidden shadow-md min-h-[300px]" role="img" aria-label="시설 위치 지도">
                <ClientOnly>
                  <FacilityMap
                    :center="{ lat: facility.lat, lng: facility.lng }"
                    :facilities="[facility]"
                    :level="3"
                    class="w-full h-full opacity-80"
                  />
                </ClientOnly>
              </div>

              <!-- 쿠팡 배너 (Desktop Sticky) -->
              <CoupangBanner class="mt-3" />

              <!-- Ad: 사이드바 (sidebar-sticky, desktop only) -->
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
definePageMeta({})

import { computed, defineAsyncComponent, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useStructuredData } from '~/composables/useStructuredData'
import { useAnalytics } from '~/composables/useAnalytics'
import { CATEGORY_META } from '~/types/facility'
import { FACILITY_DATA_SOURCE, type DataSourceInfo } from '~/utils/dataSource'
import { formatKstDate } from '~/utils/formatters'
import DetailBasicInfo from '~/components/facility/detail/DetailBasicInfo.vue'
import DetailNearby from '~/components/facility/detail/DetailNearby.vue'
import DetailContextLinks from '~/components/facility/detail/DetailContextLinks.vue'
import DetailFacilityStatus from '~/components/facility/detail/DetailFacilityStatus.vue'
import OperatingStatusBadge from '~/components/facility/OperatingStatusBadge.vue'
import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import type { FacilityCategory, FacilityDetail, FacilityDetailsAll } from '~/types/facility'
import { generateDynamicFAQ } from '~/utils/dynamicFAQ'
import { generateDynamicTips } from '~/utils/dynamicTips'
import { buildHeroActions, buildHeroBadge, buildHeroStats } from '~/utils/facilityHeroMeta'
import { RELATED_CATEGORIES } from '~/utils/seoConstants'
const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const route = useRoute()
const router = useRouter()
const { setFacilityDetailMeta } = useFacilityMeta()
import { getFacilityDisplayName } from '~/composables/useFacilityMeta'
const { setFacilitySchema, setBreadcrumbSchema } = useStructuredData()

const category = computed(() => route.params.category as FacilityCategory)
const id = computed(() => route.params.id as string)

// 도시명(한글) → 도시 허브 페이지 경로
function getCityHubPath(cityName: string): string {
  const shortCity = cityName.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const slug = CITY_NAME_TO_SLUG[cityName] || CITY_NAME_TO_SLUG[shortCity]
  return slug ? `/${slug}` : `/search?keyword=${encodeURIComponent(cityName)}`
}

// SSR: useAsyncData로 서버에서 데이터 fetch
// lazy: true → 클라이언트 네비게이션 시 즉시 페이지 전환 (SSR은 기존대로 서버에서 resolve)
const { data: facilityResponse, status, error: fetchError } = await useAsyncData(
  `facility-${category.value}-${id.value}`,
  () => $fetch<{ success: boolean; data: FacilityDetail }>(
    `/api/facilities/${category.value}/${id.value}`
  ),
  { lazy: true }
)
// fetch 에러 처리: SSR에서는 즉시, 클라이언트에서는 watch로 처리
if (import.meta.server && fetchError.value) {
  const errStatus = fetchError.value.statusCode
  if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
  }
}
if (import.meta.server && status.value === 'success' && !facilityResponse.value?.data) {
  throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
}
// 클라이언트 네비게이션 시 lazy 로드 후 에러 처리
watch(fetchError, (err) => {
  if (!err) return
  const errStatus = err.statusCode
  if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
  }
}, { immediate: true })

const facility = computed(() => facilityResponse.value?.data ?? null)
const loading = computed(() => status.value === 'pending')
// SSR에서는 createError로 에러 페이지 전환, 클라이언트 fallback용
const error = ref<{ message: string } | null>(null)

// 템플릿용 타입 안전 details 접근 (v-if 카테고리 가드로 런타임 보호)
const details = computed(() => facility.value?.details as FacilityDetailsAll | undefined)

// SSR에서 메타태그 및 JSON-LD 설정
watchEffect(() => {
  if (facility.value) {
    setFacilityDetailMeta(facility.value)
    setFacilitySchema(facility.value)
    const categoryName = CATEGORY_META[facility.value.category]?.label || facility.value.category
    const name = getFacilityDisplayName(facility.value)
    setBreadcrumbSchema([
      { name: '홈', url: '/' },
      { name: categoryName, url: `/${facility.value.category}` },
      { name, url: `/${facility.value.category}/${facility.value.id}` },
    ])
  }
})

// wifi 상세 페이지 noindex (같은 건물/장소 단위 중복이 많아 sitemap 제외)
// robots.txt 로 막지 않고 크롤은 허용해야 Googlebot 이 noindex 를 직접 확인할 수 있다.
// AED 상세 페이지는 색인 대상이며, 아래 thin-content 규칙에만 따른다.
const isLowValueCategory = computed(() => {
  const cat = facility.value?.category
  return cat === 'wifi'
})

// 빈약한 데이터 페이지 noindex 처리
const isThinContent = computed(() => {
  if (!facility.value?.details) return false
  const d = facility.value.details as Record<string, unknown>
  const cat = facility.value.category
  // clothes/trash는 원래 필드가 적으므로 noindex 제외
  if (cat === 'clothes' || cat === 'trash') return false
  // wifi는 위에서 별도 처리
  if (cat === 'wifi') return false
  // 주소 외 의미있는 상세 필드 수 계산
  const skipKeys = new Set(['govCode', 'dataDate', 'providerCode', 'providerName', 'postNo', 'postCdn1', 'postCdn2', 'sidoCd', 'sgguCd', 'emdongNm', 'ykiho', 'clCd', 'hpid', 'dutyMapimg'])
  let fieldCount = 0
  for (const [key, val] of Object.entries(d)) {
    if (skipKeys.has(key)) continue
    if (val === null || val === undefined || val === '') continue
    fieldCount++
  }
  // 이름+주소만 있는 극빈 데이터만 noindex (색인 복구를 위해 기준 완화)
  return fieldCount < 2
})

// noindex/canonical 정책 통일 — robots=noindex 를 내보낼 때는 canonical 을 동시에 내보내지 않는다.
// (정책: .omc/notes/noindex-canonical-policy.md)
const isFacilityNoindex = computed(() => isLowValueCategory.value || isThinContent.value)
useHead(computed(() => {
  if (isFacilityNoindex.value) {
    return { meta: [{ name: 'robots', content: 'noindex, follow' }] }
  }
  return {
    link: [{ rel: 'canonical', href: `https://ilsangkit.co.kr${route.path}`, key: 'canonical' }],
  }
}))

// Category metadata
const categoryMeta = computed(() => CATEGORY_META[category.value] || { label: category.value, icon: '📍' })

// 사용자에게 노출할 이름 (원본 name이 비어있거나 "-"일 때 fallback)
const displayName = computed(() => {
  if (!facility.value) return ''
  return getFacilityDisplayName(facility.value)
})

// h1 아래 표시할 주소 한 줄 (스펙: 자동생성 인트로 폐기, 주소만)
const heroDescription = computed(() => facility.value?.address ?? '')

// 카테고리별 이용 팁 & FAQ (상세 페이지 하단 콘텐츠 보강)
const categoryTips = computed(() => {
  if (!facility.value) return []
  return generateDynamicTips(facility.value)
})
const categoryFaqItems = computed(() => {
  if (!facility.value) return []
  return generateDynamicFAQ(facility.value)
})

// 데스크톱 브레드크럼 (city 포함)
const desktopBreadcrumbItems = computed(() => {
  if (!facility.value) return []
  return [
    { label: '홈', href: '/', current: false },
    { label: categoryMeta.value.label, href: `/${category.value}`, current: false },
    { label: facility.value.city, href: getCityHubPath(facility.value.city), current: false },
    { label: displayName.value, current: true },
  ]
})

const heroBadge = computed(() => (facility.value ? buildHeroBadge(facility.value) : null))
const heroStats = computed(() => (facility.value ? buildHeroStats(facility.value) : []))
const heroActions = computed(() =>
  facility.value
    ? buildHeroActions(facility.value, {
        kakaoMapUrl: kakaoMapUrl.value,
        naverMapUrl: naverMapUrl.value,
      })
    : [],
)

// 같은 지역 시설 링크
const regionLink = computed(() => {
  if (!facility.value) return null
  const city = facility.value.city
  const district = facility.value.district
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[shortCity]
  if (!citySlug) return null
  const districtSlug = district ? generateSlug(district) : ''
  // district slug가 없으면 시/도 허브로 연결
  const href = districtSlug
    ? `/${citySlug}/${districtSlug}/${category.value}`
    : `/${citySlug}`
  const label = districtSlug
    ? `${city} ${district} ${categoryMeta.value.label} 전체보기`
    : `${city} 전체 시설 보기`
  return {
    href,
    label,
    cityHref: `/${citySlug}`,
    cityLabel: `${city} 전체 시설 보기`,
  }
})

// 이 지역 다른 시설 관련 카테고리
const relatedCategories = computed(() => {
  const cat = category.value
  return (RELATED_CATEGORIES[cat] || []).filter(c => c !== cat)
})

// Generate map URLs (길찾기)
const kakaoMapUrl = computed(() => {
  if (!facility.value) return '#'
  const { lat, lng, name } = facility.value
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
})

const naverMapUrl = computed(() => {
  if (!facility.value) return '#'
  const { lat, lng, name } = facility.value
  return `https://map.naver.com/v5/directions/-/${lng},${lat},${encodeURIComponent(name)}/-/walk`
})

const isMapExpanded = ref(false)

function handleHeroAction(payload: { type: 'directions' | 'phone' | 'share' }) {
  if (payload.type === 'share') {
    handleShare()
  }
}

const { trackFacilityView, trackShareClick } = useAnalytics()
onMounted(() => {
  if (facility.value) {
    trackFacilityView({
      facilityId: facility.value.id,
      category: facility.value.category,
      name: facility.value.name,
    })
  }
})

watch(isMapExpanded, (expanded) => {
  if (import.meta.client) {
    document.body.style.overflow = expanded ? 'hidden' : ''
  }
})

// 다양한 형식의 날짜 문자열을 "YYYY-MM-DD"로 정규화
function formatDataDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  if (/^\d{8}/.test(raw)) return `${raw.substring(0, 4)}-${raw.substring(4, 6)}-${raw.substring(6, 8)}`
  const d = new Date(raw)
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return raw
}

// Data info card
const dataDate = computed(() => {
  if (!facility.value?.details) return null
  const raw = (facility.value.details as { dataDate?: string | null }).dataDate
  if (!raw) return null
  return formatDataDate(raw)
})

const dataSource = computed<DataSourceInfo | null>(() => {
  if (!facility.value) return null
  return FACILITY_DATA_SOURCE[facility.value.category] ?? null
})

// 카테고리별 최근 동기화 날짜
const { data: syncStatusResponse } = await useAsyncData(
  'sync-status',
  () => $fetch<{ success: boolean; data: Record<string, string | null> }>('/api/meta/sync-status'),
  { lazy: true }
)
const lastSyncDate = computed(() => {
  if (!facility.value || !syncStatusResponse.value?.data) return null
  const cat = facility.value.category
  return formatKstDate(syncStatusResponse.value.data[cat])
})


// AED operating hours
const formatAedTime = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null
  const s = String(start).padStart(4, '0')
  const e = String(end).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)} ~ ${e.slice(0, 2)}:${e.slice(2)}`
}

const aedOperatingHours = computed(() => {
  if (facility.value?.category !== 'aed' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').AedDetails
  const days = [
    { day: '월요일', start: d.monSttTme, end: d.monEndTme },
    { day: '화요일', start: d.tueSttTme, end: d.tueEndTme },
    { day: '수요일', start: d.wedSttTme, end: d.wedEndTme },
    { day: '목요일', start: d.thuSttTme, end: d.thuEndTme },
    { day: '금요일', start: d.friSttTme, end: d.friEndTme },
    { day: '토요일', start: d.satSttTme, end: d.satEndTme },
    { day: '일요일', start: d.sunSttTme, end: d.sunEndTme },
    { day: '공휴일', start: d.holSttTme, end: d.holEndTme },
  ]
  return days
    .map(({ day, start, end }) => ({ day, time: formatAedTime(start, end) }))
    .filter((item): item is { day: string; time: string } => item.time !== null)
})

// Pharmacy operating hours
const formatPharmacyTime = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null
  const s = String(start).padStart(4, '0')
  const e = String(end).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)} ~ ${e.slice(0, 2)}:${e.slice(2)}`
}

const pharmacyOperatingHours = computed(() => {
  if (facility.value?.category !== 'pharmacy' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').PharmacyDetails
  const days = [
    { day: '월요일', start: d.dutyTime1s, end: d.dutyTime1c },
    { day: '화요일', start: d.dutyTime2s, end: d.dutyTime2c },
    { day: '수요일', start: d.dutyTime3s, end: d.dutyTime3c },
    { day: '목요일', start: d.dutyTime4s, end: d.dutyTime4c },
    { day: '금요일', start: d.dutyTime5s, end: d.dutyTime5c },
    { day: '토요일', start: d.dutyTime6s, end: d.dutyTime6c },
    { day: '일요일', start: d.dutyTime7s, end: d.dutyTime7c },
    { day: '공휴일', start: d.dutyTime8s, end: d.dutyTime8c },
  ]
  return days
    .map(({ day, start, end }) => ({ day, time: formatPharmacyTime(start, end) }))
    .filter((item): item is { day: string; time: string } => item.time !== null)
})

// Hospital operating hours
const formatHospitalTime = (start?: string | null, end?: string | null): string | null => {
  if (!start || !end) return null
  const s = String(start).replace(':', '')
  const e = String(end).replace(':', '')
  if (s.length === 4 && e.length === 4) return `${s.slice(0, 2)}:${s.slice(2)} ~ ${e.slice(0, 2)}:${e.slice(2)}`
  return `${start} ~ ${end}`
}

const hospitalOperatingHours = computed(() => {
  if (facility.value?.category !== 'hospital' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').HospitalDetails
  const days = [
    { day: '월요일', start: d.trmtMonStart, end: d.trmtMonEnd },
    { day: '화요일', start: d.trmtTueStart, end: d.trmtTueEnd },
    { day: '수요일', start: d.trmtWedStart, end: d.trmtWedEnd },
    { day: '목요일', start: d.trmtThuStart, end: d.trmtThuEnd },
    { day: '금요일', start: d.trmtFriStart, end: d.trmtFriEnd },
    { day: '토요일', start: d.trmtSatStart, end: d.trmtSatEnd },
    { day: '일요일', start: d.trmtSunStart, end: d.trmtSunEnd },
  ]
  return days
    .map(({ day, start, end }) => ({ day, time: formatHospitalTime(start, end) }))
    .filter((item): item is { day: string; time: string } => item.time !== null)
})

// Hospital 요일별 진료시간 표 (오늘 강조 + 점심시간)
const hospitalWeeklyHours = computed(() => {
  if (facility.value?.category !== 'hospital') return []
  const d = details.value as any
  if (!d) return []
  const today = new Date().getDay() // 0=일, 1=월...6=토
  const DAY_KEYS = [
    { label: '월', start: 'trmtMonStart', end: 'trmtMonEnd', todayIdx: 1 },
    { label: '화', start: 'trmtTueStart', end: 'trmtTueEnd', todayIdx: 2 },
    { label: '수', start: 'trmtWedStart', end: 'trmtWedEnd', todayIdx: 3 },
    { label: '목', start: 'trmtThuStart', end: 'trmtThuEnd', todayIdx: 4 },
    { label: '금', start: 'trmtFriStart', end: 'trmtFriEnd', todayIdx: 5 },
    { label: '토', start: 'trmtSatStart', end: 'trmtSatEnd', todayIdx: 6 },
    { label: '일', start: 'trmtSunStart', end: 'trmtSunEnd', todayIdx: 0 },
    { label: '공휴일', start: null, end: null, todayIdx: -1 },
  ]
  const fmt = (t: string | null | undefined) => {
    if (!t) return null
    const s = String(t).padStart(4, '0')
    return `${s.slice(0, 2)}:${s.slice(2)}`
  }
  const rows = DAY_KEYS.map(dk => {
    const s = dk.start ? fmt(d[dk.start]) : null
    const e = dk.end ? fmt(d[dk.end]) : null
    const closed = !s && !e
    const isNoTrmt = (dk.label === '일' && d.noTrmtSun) || (dk.label === '공휴일' && d.noTrmtHoli)
    const isClosed = closed || isNoTrmt
    // 점심: 휴진일에는 표기하지 않음. 토는 lunchSat 우선, 일/공휴일은 비어 있음.
    const lunchStr = isClosed
      ? null
      : dk.label === '토'
        ? (d.lunchSat || d.lunchWeek || null)
        : dk.label === '일' || dk.label === '공휴일'
          ? null
          : (d.lunchWeek || null)
    return {
      day: dk.label,
      time: isClosed ? '휴진' : (s && e ? `${s} ~ ${e}` : '정보없음'),
      lunch: lunchStr || '—',
      closed: isClosed,
      isToday: dk.todayIdx === today,
    }
  })
  const hasAnyTime = rows.some(r => !r.closed && r.time !== '정보없음')
  return hasAnyTime ? rows : []
})


// AED 요일별 이용시간 표 (오늘 강조 + 24시간 표시)
const aedWeeklyHours = computed(() => {
  if (facility.value?.category !== 'aed') return []
  const d = details.value as any
  if (!d) return []
  const today = new Date().getDay()
  const fmt = (t: string | null | undefined) => {
    if (!t) return null
    const s = String(t).padStart(4, '0')
    return `${s.slice(0, 2)}:${s.slice(2)}`
  }
  const DAYS = [
    { label: '월', start: 'monSttTme', end: 'monEndTme', todayIdx: 1 },
    { label: '화', start: 'tueSttTme', end: 'tueEndTme', todayIdx: 2 },
    { label: '수', start: 'wedSttTme', end: 'wedEndTme', todayIdx: 3 },
    { label: '목', start: 'thuSttTme', end: 'thuEndTme', todayIdx: 4 },
    { label: '금', start: 'friSttTme', end: 'friEndTme', todayIdx: 5 },
    { label: '토', start: 'satSttTme', end: 'satEndTme', todayIdx: 6 },
    { label: '일', start: 'sunSttTme', end: 'sunEndTme', todayIdx: 0 },
    { label: '공휴일', start: 'holSttTme', end: 'holEndTme', todayIdx: -1 },
  ]
  const rows = DAYS.map(dk => {
    const s = fmt(d[dk.start])
    const e = fmt(d[dk.end])
    const allDay = s === '00:00' && e === '24:00'
    const closed = !s && !e
    return {
      day: dk.label,
      time: allDay ? '24시간' : closed ? '이용불가' : (s && e ? `${s} ~ ${e}` : '정보없음'),
      allDay,
      closed,
      isToday: dk.todayIdx === today,
    }
  })
  const hasAny = rows.some(r => !r.closed && r.time !== '정보없음')
  return hasAny ? rows : []
})




// Actions
const handleBack = () => {
  if (window.history.length <= 1) {
    navigateTo(`/${category.value}`)
  } else {
    router.back()
  }
}

const handleShare = async () => {
  if (!facility.value) return

  const canShare = !!navigator.share
  trackShareClick({
    contentType: 'facility',
    contentId: facility.value.id,
    method: canShare ? 'native' : 'clipboard',
  })

  const shareData = {
    title: displayName.value,
    text: `${displayName.value} - ${facility.value.roadAddress || facility.value.address}`,
    url: window.location.href,
  }

  try {
    if (canShare) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('링크가 복사되었습니다.')
    }
  } catch (err) {
    console.error('공유 실패:', err)
  }
}

// 주변 시설
const { search: searchNearby, facilities: nearbyFacilities, loading: nearbyLoading, searchNearbyCross, crossFacilities, crossLoading } = useFacilitySearch()

watch(() => facility.value, async (f) => {
  if (!f?.lat || !f?.lng) return
  await Promise.all([
    searchNearby({
      lat: f.lat,
      lng: f.lng,
      category: f.category,
      radius: 1000,
      page: 1,
      limit: 5,
    }),
    searchNearbyCross(f.category, f.id),
  ])
}, { immediate: true })

const nearbyFiltered = computed(() =>
  (nearbyFacilities.value ?? []).filter(f => f.id !== facility.value?.id).slice(0, 4)
)

const crossFacilitiesGrouped = computed(() => {
  const items = crossFacilities?.value ?? []
  if (items.length === 0) return []

  const grouped = new Map<string, Array<(typeof items)[number]>>()
  for (const item of items) {
    const list = grouped.get(item.category) ?? []
    list.push(item)
    grouped.set(item.category, list)
  }

  return Array.from(grouped.entries()).map(([cat, facilities]) => ({
    category: cat as FacilityCategory,
    meta: CATEGORY_META[cat as FacilityCategory],
    items: facilities,
  }))
})

</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
.material-symbols-outlined.filled {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
