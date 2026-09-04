<template>
  <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-4 pb-8 md:pb-10 flex flex-col gap-3">
    <!-- Breadcrumb -->
    <Breadcrumb v-if="data" :items="breadcrumbItems" />

    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
        <p class="text-slate-500 text-sm">정보 조회 중...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="py-20 text-center">
      <div class="text-4xl mb-4">😔</div>
      <p class="text-slate-600 font-medium">{{ errorMsg }}</p>
      <NuxtLink
        to="/search?category=trash"
        class="mt-4 inline-block text-primary hover:text-primary/80 font-medium text-sm"
      >
        쓰레기 배출 목록으로
      </NuxtLink>
    </div>

    <!-- Content -->
    <template v-else-if="data">
      <!-- Hero -->
      <PageHero
        eyebrow="쓰레기 배출 정보"
        :title="`${data.city} ${data.district}`"
        :description="heroDescription"
      >
        <template #sidebar>
          <div v-if="heroTags.length" class="sm:col-span-3 flex flex-wrap gap-2">
            <span
              v-for="tag in heroTags"
              :key="tag"
              class="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-full text-xs font-bold"
            >{{ tag }}</span>
          </div>
        </template>
      </PageHero>

      <!-- 배출 일정 (2칼럼 waste-grid) -->
      <SectionBlock heading="배출 일정" subtext="종류별 배출 요일·시간·방법을 한눈에 확인하세요.">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- 일반쓰레기 -->
          <WasteTypeSection
            v-if="data.details?.livingWaste"
            icon="delete"
            icon-color="amber"
            title="일반쓰레기"
            :info="data.details.livingWaste"
          />
          <!-- 음식물쓰레기 -->
          <WasteTypeSection
            v-if="data.details?.foodWaste"
            icon="restaurant"
            icon-color="green"
            title="음식물쓰레기"
            :info="data.details.foodWaste"
          />
          <!-- 재활용 -->
          <WasteTypeSection
            v-if="data.details?.recyclable"
            icon="recycling"
            icon-color="teal"
            title="재활용"
            :info="data.details.recyclable"
          />
          <!-- 대형폐기물 -->
          <div
            v-if="data.details?.bulkWaste"
            class="bg-white rounded-xl p-4 border border-line shadow-card"
          >
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                <span class="material-symbols-outlined text-violet-600 text-[20px]">weekend</span>
              </div>
              <h3 class="font-bold text-slate-900">대형폐기물</h3>
            </div>
            <div class="text-sm text-slate-600 space-y-2 pl-1">
              <div v-if="formatTimeRange(data.details.bulkWaste.beginTime, data.details.bulkWaste.endTime)" class="flex items-start gap-2">
                <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">schedule</span>
                <p><span class="font-medium text-slate-700">배출 시간:</span><span class="ml-1">{{ formatTimeRange(data.details.bulkWaste.beginTime, data.details.bulkWaste.endTime) }}</span></p>
              </div>
              <div v-if="data.details.bulkWaste.method" class="flex items-start gap-2">
                <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">info</span>
                <p><span class="font-medium text-slate-700">배출 방법:</span><span class="ml-1">{{ data.details.bulkWaste.method }}</span></p>
              </div>
              <div v-if="data.details.bulkWaste.place" class="flex items-start gap-2">
                <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">place</span>
                <p><span class="font-medium text-slate-700">배출 장소:</span><span class="ml-1">{{ data.details.bulkWaste.place }}</span></p>
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>

      <!-- Ad: 배출 일정 이후 -->
      <AdBanner />

      <!-- 주의사항과 문의 -->
      <SectionBlock
        v-if="data.details?.uncollectedDay || data.details?.manageDepartment || data.details?.managePhone"
        heading="주의사항과 문의"
        subtext="미수거일과 관리부서 연락처를 확인하세요."
      >
        <div v-if="data.details?.uncollectedDay" class="flex justify-between py-2.5 border-b border-line">
          <span class="text-slate-500 text-sm">미수거일</span>
          <strong class="text-slate-900 text-sm font-bold text-right">{{ data.details.uncollectedDay }}</strong>
        </div>
        <div v-if="data.details?.manageDepartment" class="flex justify-between py-2.5 border-b border-line">
          <span class="text-slate-500 text-sm">관리부서</span>
          <strong class="text-slate-900 text-sm font-bold text-right">{{ data.details.manageDepartment }}</strong>
        </div>
        <div v-if="data.details?.managePhone" class="flex justify-between py-2.5">
          <span class="text-slate-500 text-sm">전화</span>
          <a :href="`tel:${data.details.managePhone}`" class="text-primary text-sm font-bold hover:underline flex items-center gap-1">
            <span class="material-symbols-outlined text-[16px]">call</span>
            {{ data.details.managePhone }}
          </a>
        </div>
      </SectionBlock>

      <!-- 같은 지역 / 이용 팁 / FAQ -->
      <SectionBlock heading="같은 지역·이용 팁·FAQ" subtext="하단 보조 정보를 간단히 정리했습니다.">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- 같은 지역 -->
          <nav v-if="trashRegionLink" class="p-4 bg-slate-50 border border-line rounded-xl shadow-card">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-primary text-[20px]">explore</span>
              <h4 class="font-bold text-slate-900 text-sm">같은 지역</h4>
            </div>
            <div class="flex flex-col gap-2">
              <NuxtLink
                :to="trashRegionLink.searchHref"
                class="text-primary hover:underline text-sm font-medium"
              >{{ trashRegionLink.searchLabel }}</NuxtLink>
              <NuxtLink
                :to="trashRegionLink.regionHref"
                class="text-slate-600 hover:text-primary text-sm font-medium"
              >{{ trashRegionLink.regionLabel }}</NuxtLink>
            </div>
          </nav>

          <!-- 이용 팁 -->
          <div class="p-4 bg-slate-50 border border-line rounded-xl shadow-card">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-slate-500 text-[20px]">lightbulb</span>
              <h4 class="font-bold text-slate-900 text-sm">이용 팁</h4>
            </div>
            <ul class="space-y-1.5">
              <li v-for="(tip, i) in trashTips" :key="i" class="flex items-start gap-1.5 text-xs text-slate-600 leading-relaxed">
                <span class="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5">check</span>
                {{ tip }}
              </li>
            </ul>
          </div>

          <!-- FAQ -->
          <div v-if="trashFaqItems.length > 0" class="p-4 bg-slate-50 border border-line rounded-xl shadow-card">
            <div class="flex items-center gap-2 mb-3">
              <span class="material-symbols-outlined text-slate-500 text-[20px]">help</span>
              <h4 class="font-bold text-slate-900 text-sm">자주 묻는 질문</h4>
            </div>
            <div class="space-y-2.5">
              <div v-for="(faq, i) in trashFaqItems" :key="i">
                <p class="text-xs font-bold text-slate-900 mb-0.5">Q. {{ faq.question }}</p>
                <p class="text-xs text-slate-600 leading-relaxed">{{ faq.answer }}</p>
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>

      <!-- 데이터 정보 -->
      <DataSourceSection domain="facility" category="trash" :last-sync-date="lastSyncDate" />
    </template>
  </div>
</template>

<script setup lang="ts">
// 전역 TrustLine 억제 — 이 페이지는 자체 데이터 출처 카드를 렌더한다 (#766)
definePageMeta({ hasSourceCard: true })

import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import { buildTrashRegionPath } from '~/utils/trashRegion'
import WasteTypeSection from '~/components/trash/WasteTypeSection.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import { CATEGORY_TIPS } from '~/utils/categoryDescriptions'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { formatDotDate } from '~/utils/syncFreshness'

const trashTips = CATEGORY_TIPS.trash
const trashFaqItems = CATEGORY_FAQ.trash.slice(0, 3)

const route = useRoute()
const router = useRouter()
const { setWasteScheduleDetailMeta } = useFacilityMeta()
const { setBreadcrumbSchema, setWasteScheduleSchema, setDetailProvenance } = useStructuredData()

interface WasteTypeInfo {
  dayOfWeek?: string
  beginTime?: string
  endTime?: string
  method?: string
}

interface BulkWasteInfo {
  beginTime?: string
  endTime?: string
  method?: string
  place?: string
}

interface ScheduleDetail {
  id: number
  city: string
  district: string
  targetRegion: string | null
  emissionPlace: string | null
  details: {
    emissionPlaceType?: string
    managementZone?: string
    livingWaste?: WasteTypeInfo
    foodWaste?: WasteTypeInfo
    recyclable?: WasteTypeInfo
    bulkWaste?: BulkWasteInfo
    uncollectedDay?: string
    manageDepartment?: string
    managePhone?: string
    dataCreatedDate?: string
    lastModified?: string
  } | null
}

// ── id 형식 검증은 useAsyncData 보다 "먼저", setup 최상단에서 던진다 ──────────────
//
// 실측(2026-09-04 라이브): /trash/abc 가 HTTP 200 을 반환했다 — 네이버 진단의 소프트 404 경로.
// 원인은 검증 위치였다. 400 을 useAsyncData 핸들러 "안에서" 던지면 Nuxt 는 그 예외를
// 렌더 중단이 아니라 fetchError 로 담아두고 렌더를 계속한다. 게다가 아래 상태코드 분기는
// 404/422 만 재던지므로 400 은 어디에도 걸리지 않아, 결국 errorMsg 블록이
// HTTP 200 + index,follow 로 나갔다("잘못된 요청입니다"가 200 으로 색인되는 상태).
// setup 최상단에서 던져야 Nuxt 가 실제로 400 응답을 보낸다.
//
// ⚠️ router 레벨 정규식(`/trash/:id(\\d+)`)으로 대체하면 안 된다. trash 는
//    app/router.options.ts 의 validCategories 에도 들어 있어서, 매칭에서 빠진 /trash/abc 가
//    `/:category(...)/:id()` (시설 상세)로 흘러가 또 다른 200 을 만든다.
const TRASH_ID_PATTERN = /^[1-9]\d*$/
const rawScheduleId = String(route.params.id ?? '')
if (!TRASH_ID_PATTERN.test(rawScheduleId)) {
  throw createError({ statusCode: 400, statusMessage: '잘못된 요청입니다' })
}

// SSR: useAsyncData로 서버에서 데이터 fetch
const scheduleId = computed(() => Number(rawScheduleId))
const { data: scheduleResponse, status, error: fetchError } = await useAsyncData(
  `trash-${route.params.id}`,
  () => $fetch<{ success: boolean; data: ScheduleDetail }>(
    `/api/waste-schedules/${scheduleId.value}`
  )
)
// fetch 에러 처리: 백엔드가 "없다"고 확정한 경우(404/422)만 하드 404.
// 그 외(5xx·타임아웃·네트워크)는 fail-open — 503 + no-store 로만 표시한다(#467/#674).
if (fetchError.value) {
  const errStatus = fetchError.value.statusCode
  if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: '배출 정보를 찾을 수 없습니다' })
  } else if (import.meta.server) {
    // 실측(2026-09-04): 이 분기가 비어 있어서 백엔드 5xx 때
    // loading=false · errorMsg=null · data=null 이 되고 템플릿 세 갈래가 모두 거짓 →
    // 본문 없는 페이지가 HTTP 200 + index,follow + 사이트 기본 title 로 나갔다.
    // (기본 title 유출은 카테고리 교차 canonical 병합의 원인이기도 하다.)
    markDegradedResponse()
  }
}

const data = computed(() => scheduleResponse.value?.data ?? null)

// 구·군 단위 집계 페이지로 301 리다이렉트 (개별 trash 상세의 색인 통합).
//
// ⚠️ 목적지에 쿼리(?schedule=)를 붙이지 말 것.
// 붙이면 개별 상세 N개가 N개의 서로 다른 URL 로 되살아나, 중복 title 이 해소되지 않고
// /trash/{id} → /{city}/{district}/trash?schedule={id} 로 이동만 한다.
// 실측(2026-07-28 네이버 진단 내보내기): /trash/* 664건(표본의 33.2%)이 전부 05~06월
// 크롤 사본이었고, 그 중 이미 재크롤된 93건은 정확히 위 쿼리 형태의 새 중복으로 전환돼
// 있었다 — 예: 전북 고창군 33건이 모두 "전북 고창군 쓰레기 배출정보 | 배출일·분리수거 | 일상킷".
// canonical 은 이미 파라미터 없는 URL 을 가리키지만, 네이버 SEO 진단은 canonical 과 무관하게
// "크롤한 문서" 단위로 중복을 세므로 canonical 만으로는 지표가 내려가지 않는다.
//
// 딥링크 맥락(어느 배출 일정이었는지)은 포기한다. 대신 집계 페이지가 배출 일정 목록을
// SSR 로 렌더하므로(같은 PR), 도착 페이지에서 해당 지역의 전체 일정을 바로 볼 수 있다.
const trashRegionPath = computed(() => data.value ? buildTrashRegionPath(data.value.city, data.value.district) : null)
if (import.meta.server && trashRegionPath.value) {
  await navigateTo(trashRegionPath.value, { redirectCode: 301 })
}

const loading = computed(() => status.value === 'pending')
const errorMsg = computed(() => {
  // 일시 장애(위에서 503 으로 표시한 경우)에도 반드시 무언가를 그린다.
  // 빈 본문 200 이 아니라 "다시 시도" 안내가 보여야 사용자도 크롤러도 오해하지 않는다.
  if (fetchError.value) return '배출 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  return null
})

function formatTimeRange(begin?: string, end?: string): string | null {
  if (!begin && !end) return null
  if (begin && end) return `${begin} ~ ${end}`
  return begin || end || null
}


function goBack() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
  } else {
    navigateTo('/search?category=trash')
  }
}

// Hero description & tags
const heroDescription = computed(() =>
  '일반쓰레기, 음식물쓰레기, 재활용, 대형폐기물 배출 정보를 확인하세요.'
)
const heroTags = computed(() => {
  if (!data.value) return [] as string[]
  const tags: string[] = []
  if (data.value.targetRegion) {
    data.value.targetRegion.split('+').map((d: string) => d.trim()).filter(Boolean).forEach(d => tags.push(d))
  }
  if (data.value.emissionPlace) tags.push(data.value.emissionPlace)
  if (data.value.details?.emissionPlaceType) tags.push(data.value.details.emissionPlaceType)
  if (data.value.details?.managementZone) tags.push(`관리구역: ${data.value.details.managementZone}`)
  return tags
})

// 브레드크럼 아이템
const breadcrumbItems = computed(() => {
  if (!data.value) return []
  return [
    { label: '홈', href: '/', current: false },
    { label: '쓰레기 배출', href: '/search?category=trash', current: false },
    { label: `${data.value.city} ${data.value.district}`, href: `/trash/${data.value.id}`, current: true },
  ]
})

// 같은 지역 링크
const trashRegionLink = computed(() => {
  if (!data.value) return null
  const city = data.value.city
  const shortCity = city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const citySlug = CITY_NAME_TO_SLUG[city] || CITY_NAME_TO_SLUG[shortCity]
  if (!citySlug) return null
  const districtSlug = generateSlug(data.value.district)
  return {
    searchHref: `/search?category=trash&city=${encodeURIComponent(data.value.city)}&district=${encodeURIComponent(data.value.district)}`,
    searchLabel: `${data.value.city} ${data.value.district} 쓰레기 배출 전체보기`,
    regionHref: `/${citySlug}/${districtSlug}`,
    regionLabel: `${data.value.city} ${data.value.district} 전체 시설 보기`,
  }
})

const lastSyncDate = computed(() => {
  const ts = data.value?.details?.lastModified ?? data.value?.details?.dataCreatedDate
  return ts ? formatDotDate(String(ts)) : null
})

// SSR에서 메타태그 및 JSON-LD 설정
watchEffect(() => {
  if (data.value) {
    setWasteScheduleDetailMeta(data.value)
    setWasteScheduleSchema(data.value)
    setBreadcrumbSchema([
      { name: '홈', url: '/' },
      { name: '쓰레기 배출', url: '/search?category=trash' },
      { name: `${data.value.city} ${data.value.district}`, url: `/trash/${data.value.id}` },
    ])
    setDetailProvenance({
      domain: 'facility', category: 'trash', path: `/trash/${data.value.id}`,
      description: `${data.value.city ?? ''} ${data.value.district ?? ''} 지역의 생활폐기물 배출일정 데이터입니다. 환경부 공공데이터 기반으로 일반·음식물·재활용·대형폐기물의 배출 요일·시간·방법을 제공합니다.`.trim(),
      updatedAt: data.value.details?.lastModified ?? data.value.details?.dataCreatedDate ?? null,
    })
  }
})
</script>
