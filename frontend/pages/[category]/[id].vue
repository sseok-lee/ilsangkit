<template>
  <div class="min-h-screen bg-background-light flex flex-col text-slate-900" :style="{ '--cat': catColorVar }">
    <!-- Main Content -->
    <div class="flex-1 w-full">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20 min-h-[400px]" role="status" aria-label="정보 로딩 중">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p class="text-gray-600">{{ UI_MESSAGES.loading }}</p>
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
            class="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
          >
            {{ categoryMeta.label }} 목록으로
          </NuxtLink>
        </div>
      </div>

      <!-- Facility Detail -->
      <template v-else-if="facility">
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
                  :facilities="mapFacilities"
                  :level="mapLevel"
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

              <!-- Hero: 모바일 핵심 정보 헤더 / 데스크톱 PageHero -->
              <MobileDetailHeader
                :title="displayName"
                :eyebrow="categoryMeta.label"
                :status="operatingStatus"
                :stats="mobileHeaderStats"
                :phone="facilityPhone"
                copyable
                share-label="이 시설 공유하기"
                :kakao-map-url="kakaoMapUrl"
                :naver-map-url="naverMapUrl"
                @share="handleShare"
                @copy="copyFacilityAddress"
                @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
              />
              <PageHero
                class="hidden md:block"
                title-tag="div"
                :eyebrow="categoryMeta.label"
                :title="displayName"
                :description="facilityIntro || undefined"
                :stats="desktopHeroStats"
              />

              <!-- Ad: HERO 아래 -->
              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />

              <!-- T1 BasicInfo (기본정보·운영시간) — 헤더 광고 직후 핵심 정보 우선 -->
              <DetailBasicInfo
                :facility="facility"
                :hospital-operating-hours="hospitalOperatingHours"
                :hospital-weekly-hours="hospitalWeeklyHours"
                :hospital-weekly-hours-count="hospitalWeeklyHours.length"
                :aed-operating-hours="aedOperatingHours"
                :aed-weekly-hours="aedWeeklyHours"
                :aed-weekly-hours-count="aedWeeklyHours.length"
                :pharmacy-weekly-hours="pharmacyWeeklyHours"
                :raw-sync-date="rawSyncDate"
              />

              <!-- Ad: 기본정보 ↔ 시설현황 사이 -->
              <AdBanner />

              <!-- T2 FacilityStatus (시설현황) -->
              <DetailFacilityStatus :facility="facility" />

              <!-- Ad: 시설현황 ↔ MAP 사이 -->
              <AdBanner />

              <!-- 위치·로드뷰 -->
              <SectionBlock heading="위치·로드뷰" subtext="지도와 로드뷰로 시설 주변을 확인하세요.">
                <!--
                  wifi 장소 단위 통합: 이 장소에 설치된 AP 지점 목록.
                  한 장소에 AP 가 수십~수백 대인 경우가 흔해(서울식물원 154대) 지도 핀만으로는
                  어디에 있는지 읽히지 않는다. 설치장소상세는 AP 식별자가 아니라 구역 라벨이라
                  나열이 아니라 집계로 보여준다(해운대 백병원은 49대가 "본관 A동"을 공유).
                -->
                <div v-if="accessPointLocations.length" class="mb-3 rounded-xl border border-line bg-white p-4">
                  <div class="flex items-center justify-between gap-2 mb-3">
                    <p class="text-sm font-semibold text-slate-900">와이파이 설치 지점</p>
                    <span class="shrink-0 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      AP {{ accessPointCount }}대
                    </span>
                  </div>
                  <ul class="flex flex-wrap gap-1.5">
                    <li
                      v-for="loc in visibleAccessPointLocations"
                      :key="loc.label"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-line bg-slate-50 px-2.5 py-1.5 text-sm text-slate-700"
                    >
                      <span>{{ loc.label }}</span>
                      <span v-if="loc.count > 1" class="text-xs font-medium text-slate-500">{{ loc.count }}대</span>
                    </li>
                  </ul>
                  <p v-if="hiddenAccessPointLocationCount" class="mt-2 text-xs text-slate-500">
                    외 {{ hiddenAccessPointLocationCount }}곳 — 전체 위치는 지도에서 확인하세요.
                  </p>
                </div>

                <!-- 모바일 전용 라이브 지도 (데스크톱은 사이드바 지도 사용) -->
                <div class="md:hidden relative h-[220px] w-full rounded-xl overflow-hidden border border-line mb-3">
                  <ClientOnly>
                    <FacilityMap
                      :center="{ lat: facility.lat, lng: facility.lng }"
                      :facilities="mapFacilities"
                      :level="mapLevel"
                      class="w-full h-full !min-h-0"
                    />
                  </ClientOnly>
                  <button
                    class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
                    @click="isMapExpanded = true"
                  >
                    <span class="material-symbols-outlined text-[16px]">open_in_full</span>
                    지도 크게 보기
                  </button>
                </div>
                <div class="h-[220px] md:h-[300px]">
                  <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
                </div>
              </SectionBlock>

              <!-- 주변 시설 (same + cross category) -->
              <DetailNearby
                :nearby-facilities="nearbyFiltered"
                :nearby-loading="nearbyPending"
                :cross-facilities-grouped="crossFacilitiesGrouped"
                :cross-loading="nearbyPending"
                :category-meta="categoryMeta"
              />


              <!-- 네이버 블로그 후기 -->
              <BlogReviewSection
                v-if="facility"
                kind="facility"
                :primary-key="facility.category"
                :secondary-key="facility.id"
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
                :last-sync-date="lastSyncDate"
              />
            </article>

            <aside class="hidden md:flex lg:sticky lg:top-24 w-full flex-col">
              <!-- Map Container -->
              <div class="relative w-full aspect-square bg-[#e5e7eb] h-full rounded-xl overflow-hidden shadow-md min-h-[300px]" role="img" aria-label="시설 위치 지도">
                <ClientOnly>
                  <FacilityMap
                    :center="{ lat: facility.lat, lng: facility.lng }"
                    :facilities="mapFacilities"
                    :level="mapLevel"
                    class="w-full h-full opacity-80"
                  />
                </ClientOnly>
              </div>

              <!-- Action Buttons (Desktop Sticky Bottom) -->
              <div class="mt-3 p-4 bg-white border border-slate-200 flex gap-3 shadow-card rounded-xl">
                <button
                  class="flex-1 h-12 rounded-xl bg-slate-100 text-slate-900 font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200"
                  aria-label="이 시설 공유하기"
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
                  <div v-if="showNavDropdown" class="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                      <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                    </button>
                    <div class="h-px bg-slate-100"></div>
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
                      <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
                    </button>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({})

import { computed, defineAsyncComponent, onMounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { useAnalytics } from '~/composables/useAnalytics'
import { CATEGORY_META } from '~/types/facility'
import { formatDotDate } from '~/utils/syncFreshness'
import DetailBasicInfo from '~/components/facility/detail/DetailBasicInfo.vue'
import DetailNearby from '~/components/facility/detail/DetailNearby.vue'
import DetailContextLinks from '~/components/facility/detail/DetailContextLinks.vue'
import BlogReviewSection from '~/components/blog/BlogReviewSection.vue'
import DetailFacilityStatus from '~/components/facility/detail/DetailFacilityStatus.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import { getOperatingStatus } from '~/utils/facilityStatus'
import { resolveFacilityPhone } from '~/utils/facilityPhone'
import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import type { FacilityCategory, FacilityDetail, Facility, FacilityDetailsAll } from '~/types/facility'
import { generateDynamicFAQ } from '~/utils/dynamicFAQ'
import { generateDynamicTips } from '~/utils/dynamicTips'
import { formatOperatingHours } from '~/utils/formatOperatingHours'
import { buildHeroStats } from '~/utils/categoryHeroStats'
import { RELATED_CATEGORIES } from '~/utils/seoConstants'
import { resolveFacilitySsrOutcome } from '~/utils/facilitySsrOutcome'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import {
  parseAccessPoints,
  groupAccessPointsByLocation,
  accessPointsToMapFacilities,
  mapLevelForAccessPoints,
} from '~/utils/wifiAccessPoints'
const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const route = useRoute()
const { setFacilityDetailMeta } = useFacilityMeta()
import { buildFacilityIntro, getFacilityDisplayName, buildFacilityDescription, isUndifferentiatedFacility } from '~/composables/useFacilityMeta'
const { setFacilitySchema, setBreadcrumbSchema, setFAQSchema, setDetailProvenance } = useStructuredData()

const category = computed(() => route.params.category as FacilityCategory)
const id = computed(() => route.params.id as string)

// 도시명(한글) → 도시 허브 페이지 경로
function getCityHubPath(cityName: string): string {
  const shortCity = cityName.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const slug = CITY_NAME_TO_SLUG[cityName] || CITY_NAME_TO_SLUG[shortCity]
  return slug ? `/${slug}` : `/search?keyword=${encodeURIComponent(cityName)}`
}

// SSR/CSR 양쪽에서 SSR은 internalApiBase(loopback), CSR은 same-origin proxy 사용.
// Phase 2 cross-page 일관성: index.vue·real-estate detail과 동일하게 script-top에서 캡처.
const apiBase = useApiBase()

// SSR: useAsyncData로 서버에서 데이터 fetch
// lazy: true → 클라이언트 네비게이션 시 즉시 페이지 전환 (SSR은 기존대로 서버에서 resolve)
const { data: facilityResponse, status, error: fetchError } = await useAsyncData(
  `facility-${category.value}-${id.value}`,
  () => $fetch<{ success: boolean; data: FacilityDetail }>(
    `/api/facilities/${category.value}/${id.value}`
  ),
  { lazy: true }
)
// fetch 에러 처리: SSR에서는 즉시, 클라이언트에서는 watch로 처리.
// 판정은 순수 함수(resolveFacilitySsrOutcome)에 위임한다 — 근거·회귀 배경은 그쪽 주석 참조.
if (import.meta.server) {
  const outcome = resolveFacilitySsrOutcome({
    errorStatusCode: fetchError.value?.statusCode,
    fetchSettled: status.value === 'success',
    hasData: !!facilityResponse.value?.data,
  })
  if (outcome === 'not-found') {
    throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
  }
  if (outcome === 'degraded') {
    // 5xx·네트워크 실패·미해결 상태. throw 하면 정상 URL 이 하드 404 로 둔갑하고,
    // 그냥 두면 facility=null 인 채 렌더돼 사이트 기본 title 이 200 + index,follow 로 색인된다.
    // 503 + no-store 로만 표시해 크롤러는 기존 색인을 유지한 채 재방문하고(fail-open),
    // 실사용자는 클라이언트 refetch 로 정상 표시된다.
    markDegradedResponse()
  }
}
// 클라이언트 네비게이션 시 lazy 로드 후 에러 처리
watch(fetchError, (err) => {
  if (!err) return
  const errStatus = err.statusCode
  if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: 'Facility not found' })
  }
}, { immediate: true })

// Secondary fetch — sync-status.
// 실패 시 null fallback, 페이지는 critical(facility) 기준으로 정상 렌더된다.
//
// 2026-07-29 관련 영상(YouTube) 기능을 제거하면서 이 응답에서 youtube 도 빠졌다.
// allSettled 는 유지한다 — 항목이 하나여도 fail-open 의미(실패해도 본문은 렌더)가
// 그대로 필요하고, 이후 secondary 가 늘어날 때 형태를 다시 바꾸지 않아도 된다.
const { data: secondaryResponse } = await useAsyncData(
  `facility-secondary-${category.value}-${id.value}`,
  async () => {
    const signal = AbortSignal.timeout(8000)
    const syncR = await Promise.allSettled([
      $fetch<{ success: boolean; data: Record<string, string | null> }>(
        `${apiBase}/api/meta/sync-status`,
        { signal }
      ),
    ])
    if (syncR[0].status === 'rejected') {
      console.warn('[facility-secondary] sync-status failed:', syncR[0].reason)
    }
    return {
      syncStatus: syncR[0].status === 'fulfilled' ? syncR[0].value.data : null,
    }
  },
  {
    lazy: true,
    default: () => ({
      syncStatus: null as Record<string, string | null> | null,
    }),
  }
)

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
    // FAQPage JSON-LD 발행 (화면 FAQ 와 동일 소스 generateDynamicFAQ → SEO 구조화 데이터)
    const faqItems = generateDynamicFAQ(facility.value)
    if (faqItems.length > 0) {
      setFAQSchema(faqItems)
    }
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
// 이름·기관·주소가 모두 없어 제목이 `{지역} {카테고리}` 뿐이라 지역 내 중복이 불가피한 시설.
const isUndifferentiated = computed(() => (facility.value ? isUndifferentiatedFacility(facility.value) : false))
const isFacilityNoindex = computed(() => isLowValueCategory.value || isThinContent.value || isUndifferentiated.value)
useHead(computed(() => {
  if (isFacilityNoindex.value) {
    return { meta: [{ name: 'robots', content: 'noindex, follow' }] }
  }
  return {
    link: [{ rel: 'canonical', href: `https://ilsangkit.co.kr${route.path}`, key: 'canonical' }],
  }
}))

// 출처 Dataset provenance — isFacilityNoindex 선언 이후에 배치 (TDZ 회피)
watchEffect(() => {
  if (!facility.value) return
  setDetailProvenance({
    domain: 'facility',
    category: facility.value.category,
    path: route.path,
    description: buildFacilityDescription(facility.value),
    updatedAt: facility.value.updatedAt,
    createdAt: facility.value.createdAt,
    noindex: isFacilityNoindex.value,
  })
})

// Category metadata
const categoryMeta = computed(() => CATEGORY_META[category.value] || { label: category.value, icon: '📍' })

// OD 진화판 — 카테고리 색을 --cat CSS 변수로 주입 (kicker·타일·아이콘 테마링)
const catColorVar = computed(() => `var(--c-${category.value}, var(--brand))`)

// 사용자에게 노출할 이름 (원본 name이 비어있거나 "-"일 때 fallback)
const displayName = computed(() => {
  if (!facility.value) return ''
  return getFacilityDisplayName(facility.value)
})

// h1 아래 자연어 설명문
const facilityIntro = computed(() => {
  if (!facility.value) return ''
  return buildFacilityIntro(facility.value)
})

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

// 데스크톱 히어로 사이드바 통계
const desktopHeroStats = computed(() => {
  const cat = facility.value?.category
  if (!cat) return []

  // 운영시간 (공통 - 있는 경우만, 단 hospital/pharmacy/aed/library/parking는 별도 배너/표 제공으로 제외)
  const commonItems: { label: string; value: string }[] = []
  if (isOpen24Hours.value) {
    commonItems.push({ label: '운영', value: '24시간' })
  }
  else if (details.value?.operatingHours && !['hospital', 'pharmacy', 'aed', 'library', 'parking'].includes(cat)) {
    commonItems.push({ label: '운영시간', value: formatOperatingHours(details.value.operatingHours).split('\n')[0] })
  }

  // toilet의 경우 isOpen24Hours가 '상시' 로직을 포함하므로 details에 isOpen24Hours 결과를 주입
  // pharmacy의 경우 pharmacyWeeklyHours 기반 오늘 영업시간 결과를 주입
  const detailsWithMeta = cat === 'toilet'
    ? { ...details.value, _isOpen24Hours: isOpen24Hours.value }
    : cat === 'pharmacy'
      ? { ...details.value, _todayHours: pharmacyTodayHours.value }
      : details.value

  const categoryItems = buildHeroStats(cat, detailsWithMeta, facilityPhone.value)
  return [...commonItems, ...categoryItems]
})

// 모바일 헤더용 영업상태 — facilityStatus 유틸 재사용 (null 가능, 헤더에서 v-if 가드)
const operatingStatus = computed(() => {
  if (!facility.value) return null
  return getOperatingStatus(facility.value as unknown as Record<string, any>)
})

// 모바일 헤더 칩: 데스크톱 stat을 재사용하되 최대 4개로 제한
const mobileHeaderStats = computed(() => desktopHeroStats.value.slice(0, 4))

// 모바일 헤더 '주소복사' — DetailBasicInfo.copyAddress와 동일 로직
async function copyFacilityAddress() {
  if (!facility.value) return
  const address = facility.value.roadAddress || facility.value.address
  if (!address) return
  try {
    await navigator.clipboard.writeText(address)
    alert('주소가 복사되었습니다.')
  } catch (err) {
    console.error('주소 복사 실패:', err)
  }
}

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

// Check if 24 hours
const isOpen24Hours = computed(() => {
  if (!facility.value?.details) return false
  const det = facility.value.details as FacilityDetailsAll & Record<string, unknown>
  return det.operatingHours === '24시간' || det.is24Hour
})

// 전 카테고리 통합 전화번호
// --- wifi 장소 단위 통합 ---
// 백엔드가 같은 장소의 AP 를 한 페이지로 접고 details.accessPoints 로 전부 내려준다.
// 이 값을 안 쓰면 지도에 중심점 핀 하나만 찍혀 통합의 이점이 화면에 안 나타난다.
const accessPoints = computed(() => parseAccessPoints(details.value))
const accessPointCount = computed(() => {
  // 좌표가 없는 AP 도 실제로는 존재하므로 총 개수는 서버가 센 값을 신뢰한다.
  const n = Number((details.value as { accessPointCount?: unknown } | undefined)?.accessPointCount)
  return Number.isFinite(n) && n > 0 ? n : accessPoints.value.length
})
const accessPointLocations = computed(() => groupAccessPointsByLocation(accessPoints.value))
// 설치 장소 종류는 그룹당 평균 2.2개지만 최대 117개까지 있다(165개 그룹이 12종 초과).
// 전부 펼치면 목록이 페이지를 잡아먹어서 상한을 둔다.
const ACCESS_POINT_LOCATION_LIMIT = 12
const visibleAccessPointLocations = computed(() =>
  accessPointLocations.value.slice(0, ACCESS_POINT_LOCATION_LIMIT),
)
const hiddenAccessPointLocationCount = computed(() =>
  Math.max(0, accessPointLocations.value.length - ACCESS_POINT_LOCATION_LIMIT),
)
const mapFacilities = computed<Facility[]>(() =>
  facility.value ? accessPointsToMapFacilities(accessPoints.value, facility.value as Facility) : [],
)
const mapLevel = computed(() => mapLevelForAccessPoints(accessPoints.value))

const facilityPhone = computed(() => resolveFacilityPhone(details.value as Record<string, unknown> | undefined))

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

const showNavDropdown = ref(false)
const openNavigation = (url: string) => {
  if (facility.value) {
    const provider = url.includes('kakao') ? 'kakao' : 'naver'
    trackDirectionsClick({ facilityId: facility.value.id, category: facility.value.category, provider })
  }
  window.open(url, '_blank')
  showNavDropdown.value = false
}

const isMapExpanded = ref(false)

const { trackFacilityView, trackDirectionsClick, trackShareClick } = useAnalytics()
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

// 카테고리별 최근 동기화 날짜 — secondary fetch에서 sync-status 데이터 사용
const lastSyncDate = computed(() => {
  if (!facility.value) return null
  const data = secondaryResponse.value?.syncStatus
  if (!data) return null
  const cat = facility.value.category
  return formatDotDate(data[cat])
})

// SourceStamp용 미포맷 ISO (lastSyncDate는 DataSourceSection용 포맷 문자열)
const rawSyncDate = computed<string | null>(() => {
  if (!facility.value) return null
  const data = secondaryResponse.value?.syncStatus
  if (!data) return null
  return data[facility.value.category] ?? null
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

// Pharmacy 요일별 운영시간 표 (오늘 강조)
const pharmacyWeeklyHours = computed(() => {
  if (facility.value?.category !== 'pharmacy' || !facility.value?.details) return []
  const d = facility.value.details as import('~/types/facility').PharmacyDetails
  const today = new Date().getDay() // 0=일 ... 6=토
  const DAY_DEFS = [
    { label: '월', s: d.dutyTime1s, e: d.dutyTime1c, todayIdx: 1 },
    { label: '화', s: d.dutyTime2s, e: d.dutyTime2c, todayIdx: 2 },
    { label: '수', s: d.dutyTime3s, e: d.dutyTime3c, todayIdx: 3 },
    { label: '목', s: d.dutyTime4s, e: d.dutyTime4c, todayIdx: 4 },
    { label: '금', s: d.dutyTime5s, e: d.dutyTime5c, todayIdx: 5 },
    { label: '토', s: d.dutyTime6s, e: d.dutyTime6c, todayIdx: 6 },
    { label: '일', s: d.dutyTime7s, e: d.dutyTime7c, todayIdx: 0 },
    { label: '공휴일', s: d.dutyTime8s, e: d.dutyTime8c, todayIdx: -1 },
  ]
  const rows = DAY_DEFS.map(({ label, s, e, todayIdx }) => {
    const time = formatPharmacyTime(s, e)
    return { day: label, time: time ?? '휴무', closed: time === null, isToday: todayIdx === today }
  })
  return rows.some(r => !r.closed) ? rows : []
})

// Pharmacy 오늘 영업시간 — pharmacyWeeklyHours(기존, KST 오늘 판정 포함)에서 오늘 행을 뽑아 도출 (휴무/데이터없음 → null)
const pharmacyTodayHours = computed<string | null>(() => {
  const today = pharmacyWeeklyHours.value.find(r => r.isToday)
  return today && !today.closed ? today.time : null
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

// 주변 시설 — 메인 facility가 lazy라 좌표 확보 위해 상세 1회 재패칭 후 allSettled로 SSR 합류
const { data: nearbyData, status: nearbyStatus } = await useAsyncData(
  `nearby-${category.value}-${id.value}`,
  async () => {
    const detail = await $fetch<{ success: boolean; data: FacilityDetail }>(
      `${apiBase}/api/facilities/${category.value}/${id.value}`,
    ).catch(() => null)
    const f = detail?.data
    const crossP = $fetch<{ success: boolean; data: { items: Facility[] } }>(
      `${apiBase}/api/facilities/${category.value}/${id.value}/nearby`,
    )
    const nearbyP = (f?.lat && f?.lng)
      ? $fetch<{ success: boolean; data: { items: Facility[] } }>(
          `${apiBase}/api/facilities/search`,
          {
            method: 'POST',
            body: { category: f.category, lat: f.lat, lng: f.lng, radius: 1000, page: 1, limit: 10 },
          },
        )
      : Promise.resolve(null)
    const [nearbyR, crossR] = await Promise.allSettled([nearbyP, crossP])
    return {
      nearby: nearbyR.status === 'fulfilled' ? (nearbyR.value?.data?.items ?? []) : [],
      cross: crossR.status === 'fulfilled' ? (crossR.value?.data?.items ?? []) : [],
    }
  },
  { lazy: true, default: () => ({ nearby: [] as Facility[], cross: [] as Facility[] }) },
)

const nearbyPending = computed(() => nearbyStatus.value === 'pending')

const nearbyFiltered = computed(() =>
  (nearbyData.value?.nearby ?? []).filter(f => f.id !== facility.value?.id).slice(0, 4)
)

const crossFacilitiesGrouped = computed(() => {
  const items = nearbyData.value?.cross ?? []
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
