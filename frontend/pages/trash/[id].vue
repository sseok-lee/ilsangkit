<template>
  <div class="bg-white text-ink min-h-screen">
  <div class="page-container pb-10">
    <!-- Loading -->
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="text-center">
        <div
          class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"
        ></div>
        <p class="text-muted text-sm">정보 조회 중...</p>
      </div>
    </div>

    <!-- Error -->
    <div v-else-if="errorMsg" class="py-20 text-center">
      <div class="text-4xl mb-4">😔</div>
      <p class="text-muted font-medium">{{ errorMsg }}</p>
      <UiButton variant="secondary" to="/search?category=trash" class="mt-4">쓰레기 배출 목록으로</UiButton>
    </div>

    <!-- Content -->
    <template v-else-if="data">
      <PageHead
        eyebrow="쓰레기 배출 정보"
        :title="`${data.city} ${data.district}`"
        :description="heroDescription"
      >
        <template #breadcrumb>
          <Breadcrumb :items="breadcrumbItems" class="mb-4" />
        </template>
        <ul v-if="heroTags.length" class="mt-4 flex flex-wrap gap-2" aria-label="적용 조건">
          <li
            v-for="tag in heroTags"
            :key="tag"
            class="rounded-full border border-line px-2.5 py-1 text-xs font-semibold text-muted"
          >{{ tag }}</li>
        </ul>
      </PageHead>

      <!-- Ad: 제목 아래 -->
      <AdBanner />

      <div class="mt-6 flex flex-wrap gap-2">
        <UiButton
          v-if="returnContext"
          variant="secondary"
          :href="returnContext.href"
          @click="returnToContext"
        >{{ returnContext.label }}</UiButton>
        <UiButton
          v-else-if="trashRegionLink"
          variant="secondary"
          :to="trashRegionLink.searchHref"
        >{{ data.city }} {{ data.district }} 목록으로</UiButton>
      </div>

      <SectionBlock
        variant="flat"
        heading="원본 배출 일정"
        subtext="공공데이터 원문에 기록된 적용 조건과 출처입니다."
      >
        <WasteScheduleContent
          :schedule="data"
          scope="conditional"
          :condition-text="sourceConditionText"
        />
      </SectionBlock>

      <!-- Ad: 배출 일정 뒤 -->
      <AdBanner />

      <!-- 주의사항과 문의 -->
      <SectionBlock
        v-if="
          data.details?.uncollectedDay ||
          data.details?.manageDepartment ||
          data.details?.managePhone
        "
        variant="flat"
        heading="주의사항과 문의"
        subtext="미수거일과 관리부서 연락처를 확인하세요."
      >
        <div
          v-if="data.details?.uncollectedDay"
          class="flex justify-between py-2.5 border-b border-line"
        >
          <span class="text-muted text-sm">미수거일</span>
          <strong class="text-ink text-sm font-bold text-right">{{
            data.details.uncollectedDay
          }}</strong>
        </div>
        <div
          v-if="data.details?.manageDepartment"
          class="flex justify-between py-2.5 border-b border-line"
        >
          <span class="text-muted text-sm">관리부서</span>
          <strong class="text-ink text-sm font-bold text-right">{{
            data.details.manageDepartment
          }}</strong>
        </div>
        <div v-if="data.details?.managePhone" class="flex justify-between py-2.5">
          <span class="text-muted text-sm">전화</span>
          <a
            :href="`tel:${data.details.managePhone}`"
            class="text-primary text-sm font-bold hover:underline flex items-center gap-1"
          >
            <span aria-hidden="true" class="material-symbols-outlined text-[16px]">call</span>
            {{ data.details.managePhone }}
          </a>
        </div>
      </SectionBlock>

      <!-- 같은 지역 / 이용 팁 / FAQ -->
      <SectionBlock variant="flat" heading="같은 지역·이용 팁·FAQ" subtext="하단 보조 정보를 간단히 정리했습니다.">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- 같은 지역 -->
          <nav
            v-if="trashRegionLink"
            class="p-4 bg-white border border-line rounded-[10px]"
          >
            <div class="flex items-center gap-2 mb-3">
              <span aria-hidden="true" class="material-symbols-outlined text-primary text-[20px]">explore</span>
              <h3 class="text-[15px] font-semibold text-ink">같은 지역</h3>
            </div>
            <div class="flex flex-col gap-2">
              <NuxtLink
                :to="trashRegionLink.searchHref"
                class="text-primary hover:underline text-sm font-medium"
              >
                {{ trashRegionLink.searchLabel }}
              </NuxtLink>
              <NuxtLink
                :to="trashRegionLink.regionHref"
                class="text-muted hover:text-primary text-sm font-medium"
              >
                {{ trashRegionLink.regionLabel }}
              </NuxtLink>
            </div>
          </nav>

          <nav
            v-if="data.applicableAreas.length"
            class="p-4 bg-white border border-line rounded-[10px]"
          >
            <div class="flex items-center gap-2 mb-3">
              <span aria-hidden="true" class="material-symbols-outlined text-primary text-[20px]">location_on</span>
              <h3 class="text-[15px] font-semibold text-ink">적용 동</h3>
            </div>
            <div class="flex flex-col gap-2">
              <NuxtLink
                v-for="area in data.applicableAreas"
                :key="area.href"
                :to="area.href"
                class="text-primary hover:underline text-sm font-medium"
              >
                {{ applicableAreaLabel(area) }}
              </NuxtLink>
            </div>
          </nav>

          <!-- 이용 팁 -->
          <div class="p-4 bg-white border border-line rounded-[10px]">
            <div class="flex items-center gap-2 mb-3">
              <span aria-hidden="true" class="material-symbols-outlined text-muted text-[20px]">lightbulb</span>
              <h3 class="text-[15px] font-semibold text-ink">이용 팁</h3>
            </div>
            <ul class="space-y-1.5">
              <li
                v-for="(tip, i) in trashTips"
                :key="i"
                class="flex items-start gap-1.5 text-xs text-muted leading-relaxed"
              >
                <span aria-hidden="true" class="material-symbols-outlined text-[14px] text-primary shrink-0 mt-0.5">check</span>
                {{ tip }}
              </li>
            </ul>
          </div>

          <!-- FAQ -->
          <div
            v-if="trashFaqItems.length > 0"
            class="p-4 bg-white border border-line rounded-[10px]"
          >
            <div class="flex items-center gap-2 mb-3">
              <span aria-hidden="true" class="material-symbols-outlined text-muted text-[20px]">help</span>
              <h3 class="text-[15px] font-semibold text-ink">자주 묻는 질문</h3>
            </div>
            <div class="space-y-2.5">
              <div v-for="(faq, i) in trashFaqItems" :key="i">
                <p class="text-xs font-bold text-ink mb-0.5">Q. {{ faq.question }}</p>
                <p class="text-xs text-muted leading-relaxed">{{ faq.answer }}</p>
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>

      <!-- 데이터 정보 -->
      <DataSourceSection domain="facility" category="trash" variant="flat" :last-sync-date="lastSyncDate" />
    </template>
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CITY_NAME_TO_SLUG, generateSlug } from '~/composables/useRegions'
import WasteScheduleContent from '~/components/trash/WasteScheduleContent.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHead from '~/components/common/PageHead.vue'
import UiButton from '~/components/common/UiButton.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import { CATEGORY_TIPS } from '~/utils/categoryDescriptions'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { formatDotDate } from '~/utils/syncFreshness'
import {
  consumeLegacyTrashFromFragment,
  readTrashReturnContext,
  sanitizeTrustedTrashReturn,
  type TrashReturnContext,
} from '~/utils/trashReturnContext'
import type { ApplicableWasteArea } from '~/types/wasteArea'

const trashTips = CATEGORY_TIPS.trash
const trashFaqItems = CATEGORY_FAQ.trash.slice(0, 3)

const route = useRoute()
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
  sourceUrl?: string | null
  govCode?: string | null
  sourceStatus?: string | null
  applicableAreas?: ApplicableWasteArea[]
  appliesTo?: Array<{
    areaId: number | null
    districtCode: string | null
    scope: string
    conditionText: string
    state: string
    reason: string
    evidence: unknown
  }>
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
const {
  data: scheduleResponse,
  status,
  error: fetchError,
} = await useAsyncData(`trash-${route.params.id}`, () =>
  $fetch<{ success: boolean; data: ScheduleDetail }>(`/api/waste-schedules/${scheduleId.value}`)
)
// fetch 에러 처리: 백엔드가 "없다"고 확정한 경우(404/422)만 하드 404.
// 그 외(5xx·타임아웃·네트워크)는 fail-open — 503 + no-store 로만 표시한다(#467/#674).
if (fetchError.value) {
  const errStatus = fetchError.value.statusCode
  if (errStatus === 410) {
    throw createError({ statusCode: 410, statusMessage: '종료된 배출 일정입니다' })
  } else if (errStatus === 404 || errStatus === 422) {
    throw createError({ statusCode: 404, statusMessage: '배출 정보를 찾을 수 없습니다' })
  } else if (import.meta.server) {
    // 실측(2026-09-04): 이 분기가 비어 있어서 백엔드 5xx 때
    // loading=false · errorMsg=null · data=null 이 되고 템플릿 세 갈래가 모두 거짓 →
    // 본문 없는 페이지가 HTTP 200 + index,follow + 사이트 기본 title 로 나갔다.
    // (기본 title 유출은 카테고리 교차 canonical 병합의 원인이기도 하다.)
    markDegradedResponse()
  }
}

const data = computed(() => {
  const detail = scheduleResponse.value?.data
  return detail ? { ...detail, applicableAreas: detail.applicableAreas ?? [] } : null
})

const loading = computed(() => status.value === 'pending')
const errorMsg = computed(() => {
  // 일시 장애(위에서 503 으로 표시한 경우)에도 반드시 무언가를 그린다.
  // 빈 본문 200 이 아니라 "다시 시도" 안내가 보여야 사용자도 크롤러도 오해하지 않는다.
  if (fetchError.value) return '배출 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
  return null
})

// Hero description & tags
const heroDescription = computed(
  () => '일반쓰레기, 음식물쓰레기, 재활용, 대형폐기물 배출 정보를 확인하세요.'
)
const heroTags = computed(() => {
  if (!data.value) return [] as string[]
  const tags: string[] = []
  if (data.value.targetRegion) {
    data.value.targetRegion
      .split('+')
      .map((d: string) => d.trim())
      .filter(Boolean)
      .forEach((d) => tags.push(d))
  }
  if (data.value.emissionPlace) tags.push(data.value.emissionPlace)
  if (data.value.details?.emissionPlaceType) tags.push(data.value.details.emissionPlaceType)
  if (data.value.details?.managementZone)
    tags.push(`관리구역: ${data.value.details.managementZone}`)
  return tags
})

// 브레드크럼 아이템
const breadcrumbItems = computed(() => {
  if (!data.value) return []
  return [
    { label: '홈', href: '/', current: false },
    { label: '쓰레기 배출', href: '/search?category=trash', current: false },
    {
      label: `${data.value.city} ${data.value.district}`,
      href: `/trash/${data.value.id}`,
      current: true,
    },
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

const returnContext = ref<TrashReturnContext | null>(null)
const sourceConditionText = computed(() => {
  if (!data.value) return ''
  const rawConditions = [
    ...new Set(
      (data.value.appliesTo ?? [])
        .map((item) => item.conditionText?.trim())
        .filter((text): text is string => Boolean(text))
    ),
  ]
  if (rawConditions.length) return `원본 적용 조건: ${rawConditions.join('\n')}`
  return data.value.targetRegion
    ? `원본 적용 지역: ${data.value.targetRegion}`
    : '원본 적용 조건을 확인하세요.'
})

function applicableAreaLabel(area: ApplicableWasteArea): string {
  return area.conditionText ? `${area.name} · ${area.conditionText}` : area.name
}

function refreshReturnContext() {
  returnContext.value =
    consumeLegacyTrashFromFragment(
      scheduleId.value,
      `${data.value?.city ?? ''} ${data.value?.district ?? ''} 목록으로`.trim()
    ) || readTrashReturnContext(scheduleId.value)
}

let cancelPendingReturnScroll: (() => void) | null = null

function currentPathWithSearch(): string {
  return `${window.location.pathname}${window.location.search}`
}

function restoreReturnScroll(context: TrashReturnContext) {
  if (
    !import.meta.client ||
    typeof context.scrollY !== 'number' ||
    !Number.isFinite(context.scrollY)
  )
    return
  const targetHref = sanitizeTrustedTrashReturn(context.href)
  if (!targetHref) return

  cancelPendingReturnScroll?.()

  const top = context.scrollY
  let canceled = false
  let firstFrame = 0
  let secondFrame = 0
  let retryTimer = 0

  const cleanup = () => {
    window.removeEventListener('wheel', cancel, true)
    window.removeEventListener('touchmove', cancel, true)
    window.removeEventListener('keydown', cancel, true)
    window.removeEventListener('pointerdown', cancel, true)
    if (firstFrame) window.cancelAnimationFrame(firstFrame)
    if (secondFrame) window.cancelAnimationFrame(secondFrame)
    if (retryTimer) window.clearTimeout(retryTimer)
    if (cancelPendingReturnScroll === cancel) cancelPendingReturnScroll = null
  }
  const cancel = () => {
    canceled = true
    cleanup()
  }
  const restore = () => {
    if (canceled) return
    if (currentPathWithSearch() !== targetHref) {
      cancel()
      return
    }
    window.scrollTo({ top })
  }

  cancelPendingReturnScroll = cancel
  window.addEventListener('wheel', cancel, { once: true, capture: true, passive: true })
  window.addEventListener('touchmove', cancel, { once: true, capture: true, passive: true })
  window.addEventListener('keydown', cancel, { once: true, capture: true })
  window.addEventListener('pointerdown', cancel, { once: true, capture: true })

  firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      restore()
      retryTimer = window.setTimeout(() => {
        restore()
        cleanup()
      }, 120)
    })
  })
}

function matchingSafeBackHref(context: TrashReturnContext): boolean {
  if (!import.meta.client) return false
  const rawBack =
    window.history.state && typeof window.history.state === 'object'
      ? (window.history.state as { back?: unknown }).back
      : undefined
  return typeof rawBack === 'string' && sanitizeTrustedTrashReturn(rawBack) === context.href
}

async function returnToContext(event: MouseEvent) {
  if (
    event.defaultPrevented ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    event.button !== 0
  )
    return
  const context = returnContext.value
  if (!context) return
  event.preventDefault()

  if (!import.meta.client) {
    await navigateTo(context.href)
    return
  }

  const router = typeof useNuxtApp === 'function' ? useNuxtApp().$router : null
  if (!router?.afterEach || !router?.push || !router?.back) {
    await navigateTo(context.href)
    restoreReturnScroll(context)
    return
  }

  if (matchingSafeBackHref(context) && window.history.length > 1) {
    let removed = false
    const remove = router.afterEach(() => {
      if (removed) return
      removed = true
      remove()
      restoreReturnScroll(context)
    })
    router.back()
    window.setTimeout(() => {
      if (removed) return
      removed = true
      remove()
    }, 1500)
    return
  }

  await router.push(context.href)
  restoreReturnScroll(context)
}

onMounted(() => {
  refreshReturnContext()
  window.setTimeout(() => {
    if (!returnContext.value) refreshReturnContext()
  }, 0)
  window.setTimeout(() => {
    if (!returnContext.value) refreshReturnContext()
  }, 50)
})

useHead(
  computed(() => ({
    meta: [{ name: 'robots', content: 'noindex, follow', key: 'robots' }],
  }))
)

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
      domain: 'facility',
      category: 'trash',
      path: `/trash/${data.value.id}`,
      description:
        `${data.value.city ?? ''} ${data.value.district ?? ''} 지역의 생활폐기물 배출일정 데이터입니다. 환경부 공공데이터 기반으로 일반·음식물·재활용·대형폐기물의 배출 요일·시간·방법을 제공합니다.`.trim(),
      updatedAt: data.value.details?.lastModified ?? data.value.details?.dataCreatedDate ?? null,
    })
  }
})
</script>
