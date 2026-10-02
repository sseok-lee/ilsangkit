<template>
  <div class="bg-white text-ink min-h-screen">
    <div class="page-container pb-10">
      <PageHead
        eyebrow="공매"
        :title="pageHeading"
        :description="`온비드 부동산 공매 물건을 지역·용도·상태별로 조회하세요.`"
      >
        <template #breadcrumb>
          <Breadcrumb :items="breadcrumbItems" class="mb-4" />
        </template>
      </PageHead>

      <!-- 필터 -->
      <SectionBlock variant="flat" heading="필터" subtext="용도·상태·지역으로 공매 물건을 좁혀보세요.">
        <div class="rounded-lg bg-background-light p-5">
          <AuctionFilters
            :keyword="keyword"
            :status-mode="statusMode"
            @update:keyword="onKeyword"
            @update:status-mode="onStatusMode"
            :usage="usage"
            :status="filterStatus"
            :city="filterCity"
            :district="filterDistrict"
            @update:usage="onUsage"
            @update:status="onStatus"
            @update:city="onCity"
            @update:district="onDistrict"
          />
          <label class="mt-4 grid gap-1 text-sm text-muted" for="auction-sort">정렬
            <select id="auction-sort" :value="sort" class="min-h-11 rounded-lg border border-line px-3 text-ink" @change="applyQuery({ sort: ($event.target as HTMLSelectElement).value, page: undefined })">
              <option value="deadline" :selected="sort === 'deadline'">마감 임박순</option>
              <option value="apsl" :selected="sort === 'apsl'">감정가 높은순</option>
              <option value="bidRate" :selected="sort === 'bidRate'">낙찰가율 높은순</option>
            </select>
          </label>
        </div>
      </SectionBlock>

      <!-- Ad: 필터 직후 (시설·부동산 목록 페이지와 동일 위치) -->
      <AdBanner />

      <!-- 결과 -->
      <div v-if="itemsError" role="alert" class="border-y border-line py-10 text-center">
        <p>공매 물건을 불러오지 못했습니다.</p>
        <button type="button" class="min-h-11 px-4 text-primary" @click="refresh()">다시 시도</button>
      </div>
      <p v-else-if="pending" role="status" class="py-10 text-center text-muted">데이터를 불러오는 중입니다.</p>
      <SectionBlock
        variant="flat"
        v-else-if="data && data.items.length > 0"
        :heading="`${pageHeading} 목록`"
        subtext="감정가·최저가와 입찰 마감일을 확인하세요."
      >
        <template #right>
          <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {{ data.total.toLocaleString('ko-KR') }}건
          </span>
        </template>
        <div class="flex flex-col">
          <AuctionCard variant="row" v-for="item in data.items" :key="item.cltrMngNo" :item="item" />
        </div>
        <Pagination
          class="flex-wrap"
          :href-for="pageHref"
          :current-page="currentPage"
          :total-pages="data.totalPages"
          @page-change="onPageChange"
        />
      </SectionBlock>

      <SectionBlock variant="flat" v-else-if="data && data.items.length === 0" :heading="`${pageHeading} 목록`">
        <EmptyState icon="gavel" title="조회된 공매 물건이 없습니다" description="필터를 변경하거나 전체 목록을 확인해 보세요.">
          <div class="flex items-center justify-center gap-3">
            <button
              v-if="hasActiveFilter"
              class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-background-light text-ink rounded-lg text-sm font-medium hover:bg-line transition-colors"
              @click="resetFilters"
            >
              <span class="material-symbols-outlined text-[16px]">refresh</span>
              필터 초기화
            </button>
            <NuxtLink
              to="/auction"
              class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              전체 공매 보기
            </NuxtLink>
          </div>
        </EmptyState>
      </SectionBlock>

      <SectionBlock variant="flat" v-else :heading="`${pageHeading} 목록`">
        <div class="rounded-xl bg-background-light p-12 text-center">
          <p class="text-muted text-sm">데이터를 불러오는 중입니다.</p>
        </div>
      </SectionBlock>

      <DataSourceSection variant="flat" domain="auction" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, watchEffect } from 'vue'
import { suppressAds } from '~/composables/useAdsPolicy'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import type { LocationQueryRaw } from 'vue-router'
import { useAuction } from '~/composables/useAuction'
import { USAGE_GROUP_LABEL } from '~/types/auction'
import { buildAuctionListTitle, buildAuctionListHeading } from '~/utils/auctionHead'
import { SITE_URL } from '~/utils/seoConstants'
import { useStructuredData } from '~/composables/useStructuredData'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import AuctionFilters from '~/components/auction/AuctionFilters.vue'
import Pagination from '~/components/common/Pagination.vue'
import PageHead from '~/components/common/PageHead.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import EmptyState from '~/components/common/EmptyState.vue'

const route = useRoute()
const router = useRouter()

// Read filter state from query params
const usage = computed(() => (route.query.usage as string) ?? '')
const filterStatus = computed(() => (route.query.status as string) ?? '')
const filterCity = computed(() => (route.query.city as string) ?? '')
const filterDistrict = computed(() => (route.query.district as string) ?? '')
const currentPage = computed(() => Number(route.query.page ?? 1))
const keyword = computed(() => typeof route.query.q === 'string' ? route.query.q.trim() : '')
const statusMode = computed(() => route.query.statusMode === 'exact' ? 'exact' : 'legacy')
const sort = computed(() => typeof route.query.sort === 'string' ? route.query.sort : 'deadline')

// 알려진 용도 키인가. 빈 값(필터 없음)도 정상으로 본다.
//
// 예전 isIndexable 은 파라미터 '이름'만 화이트리스트했고 '값'은 한 번도 검증하지 않았다.
// 그래서 크롤러가 지어낸 ?usage=zzz 가 HTTP 200 + index,follow + self-canonical 로 나갔다.
// 알 수 없는 값은 buildAuctionListHeading 이 라벨 폴백('부동산 공매 물건')을 쓰므로
// 그 URL 들의 title/description 이 전부 바닥 목록과 동일하다 —
// 파라미터 값 하나당 중복 title 문서가 하나씩 늘어나는 무한 증식 경로였다.
const isKnownUsage = computed(
  () => !usage.value || Object.prototype.hasOwnProperty.call(USAGE_GROUP_LABEL, usage.value),
)

// noindex for arbitrary filter combos (only base list and known ?usage= values are indexed)
const isIndexable = computed(() => {
  const q = route.query
  const keys = Object.keys(q).filter((k) => q[k] !== '' && q[k] != null)
  const nonIndexableKeys = keys.filter((k) => !['usage'].includes(k))
  if (nonIndexableKeys.length > 0) return false
  return isKnownUsage.value
})

// H1(pageHeading)과 <title>(pageTitle)은 분리 — 사이트명 suffix 는 <title> 에만 붙는다.
const pageHeading = computed(() => buildAuctionListHeading(usage.value))
const pageTitle = computed(() => buildAuctionListTitle(usage.value))

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '공매', href: '/auction', current: false },
  { label: pageHeading.value, href: '/auction/list', current: true },
])

const auction = useAuction()

const dataKey = computed(() => `auction-list-${JSON.stringify([usage.value, filterStatus.value, statusMode.value, keyword.value, filterCity.value, filterDistrict.value, sort.value, currentPage.value])}`)
const { data, error: itemsError, pending, refresh } = await useAsyncData(
  dataKey,
  () => auction.getItems({
    keyword: keyword.value || undefined,
    statusMode: statusMode.value === 'exact' ? 'exact' : undefined,
    sort: sort.value,
    usage: usage.value || undefined,
    status: filterStatus.value || undefined,
    city: filterCity.value || undefined,
    district: filterDistrict.value || undefined,
    page: currentPage.value,
    limit: 20,
  }),
  // Reactive key keeps SSR and client history on the same filter payload.
  { default: () => null },
)

// 일시 장애를 200 + index 로 굳히지 않는다 (#467 / #674). 사용자에겐 페이지를 그대로
// 보여주되(fail-open) 크롤러에겐 503 + no-store 로 알린다.
//
// ⚠️ 이 호출은 반드시 useAsyncData 핸들러 **밖**이어야 한다. 핸들러 본문은 중첩 async 라
// Nuxt 인스턴스 컨텍스트가 없고, 그 안에서 부르면 useNuxtApp() 이 그 자리에서 throw 해
// 503 이 영영 나가지 않는다. 실측 2026-09-04: 핸들러 안에 두었더니 `/auction/list?page=abc`
// 가 200 으로 응답하면서 payload 에 "A composable that requires access to the Nuxt
// instance" 를 싣고 있었다 — degraded 신호는 한 번도 나가지 않았다.
//
// 422 는 일시 장애가 아니다. 백엔드가 "이 파라미터로는 불가능하다"고 확정한 것이므로
// 503 으로 내보내면 절대 유효해지지 않을 URL 을 크롤러가 계속 재방문한다. 확정 부재는
// 404 로 끊는다 — 상세 페이지들(trash/[id], subway/[slug], guide/[slug])과 같은 규칙이다.
const itemsErrStatus = (itemsError.value as { statusCode?: number } | null)?.statusCode
if (itemsErrStatus === 422) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}
else if (itemsError.value && import.meta.server) {
  markDegradedResponse()
}

// 한 번의 사용자 동작이 여러 emit을 낼 수 있다(예: 시/도 변경 시 시군구 리셋까지 동반 emit).
// 각 emit마다 router.push하면 두 번째 push가 stale route.query를 펼쳐 첫 push를 덮어써(=clobber)
// 지역 필터가 동작하지 않았다. 같은 tick의 patch들을 누적해 nextTick에 한 번만 push한다.
let pendingQuery: LocationQueryRaw | null = null
function applyQuery(patch: LocationQueryRaw) {
  pendingQuery = { ...(pendingQuery ?? route.query), ...patch }
  void nextTick(() => {
    if (!pendingQuery) return
    const q = pendingQuery
    pendingQuery = null
    router.push({ query: q })
  })
}
function onKeyword(value: string) {
  applyQuery({ q: value || undefined, page: undefined })
}
function onStatusMode(value: string) {
  applyQuery({ statusMode: value === 'exact' ? 'exact' : undefined, page: undefined })
}
function pageHref(page: number) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (key !== 'page' && typeof value === 'string' && value) query.set(key, value)
  }
  if (page > 1) query.set('page', String(page))
  return `/auction/list${query.size ? `?${query}` : ''}`
}
function onUsage(v: string) {
  applyQuery({ usage: v || undefined, page: undefined })
}
function onStatus(v: string) {
  applyQuery({ status: v || undefined, page: undefined })
}
function onCity(v: string) {
  applyQuery({ city: v || undefined, district: undefined, page: undefined })
}
function onDistrict(v: string) {
  applyQuery({ district: v || undefined, page: undefined })
}
function onPageChange(p: number) {
  applyQuery({ page: p === 1 ? undefined : p })
}

const hasActiveFilter = computed(() =>
  !!(keyword.value || usage.value || filterStatus.value || filterCity.value || filterDistrict.value),
)

watchEffect(() => suppressAds(!isIndexable.value || !!itemsError.value || !!pending.value || !data.value?.items.length))

function resetFilters() {
  router.push({ query: {} })
}

const selfUrl = computed(() => {
  const base = `${SITE_URL}/auction/list`
  // 알 수 없는 usage 값은 URL 신호에서도 뺀다. noindex 를 걸어도 og:url 이 그 주소를
  // 대표 URL 로 광고하면 크롤러에 중복 주소가 계속 노출되기 때문이다.
  return isKnownUsage.value && usage.value ? `${base}?usage=${encodeURIComponent(usage.value)}` : base
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공매', url: '/auction' },
  { name: pageHeading.value, url: '/auction/list' },
])

useHead(() => {
  const title = pageTitle.value
  const description = `온비드 부동산 공매 물건을 지역·용도·상태별로 조회하세요.`
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfUrl.value },
  ]
  if (isIndexable.value) {
    // 공매 목록도 og:image(정적 PNG) 노출 — 네이버 SERP/카톡·블로그 공유 썸네일.
    const ogImage = `${SITE_URL}/og-image.png`
    meta.push(
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: ogImage },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: title },
      { property: 'og:site_name', content: '일상킷' },
      { property: 'og:locale', content: 'ko_KR' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
    )
  }
  else {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  // noindex-canonical-policy: noindex 페이지는 canonical 을 생략한다.
  // 알 수 없는 usage 값을 bare /auction/list 로 canonical 하지 않는 이유 — noindex 와
  // canonical 을 함께 내보내면 크롤러가 두 신호 중 하나를 임의로 무시한다(프로젝트 정책).
  // 파라미터 URL 은 어차피 색인 대상이 아니고, 'noindex, follow' 가 링크만 흘려보내
  // 바닥 목록으로 통합되게 하는 편이 신호가 하나뿐이라 더 안전하다.
  return {
    title,
    meta,
    link: isIndexable.value ? [{ rel: 'canonical', href: selfUrl.value }] : [],
  }
})
</script>
