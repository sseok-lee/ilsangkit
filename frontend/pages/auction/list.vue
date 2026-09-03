<template>
  <div class="bg-background-light min-h-screen">
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="공매"
        :title="pageHeading"
        :description="`온비드 부동산 공매 물건을 지역·용도·상태별로 조회하세요.`"
      />

      <!-- 필터 -->
      <SectionBlock heading="필터" subtext="용도·상태·지역으로 공매 물건을 좁혀보세요.">
        <AuctionFilters
          :usage="usage"
          :status="filterStatus"
          :city="filterCity"
          :district="filterDistrict"
          @update:usage="onUsage"
          @update:status="onStatus"
          @update:city="onCity"
          @update:district="onDistrict"
        />
      </SectionBlock>

      <!-- Ad: 필터 직후 (시설·부동산 목록 페이지와 동일 위치) -->
      <AdBanner />

      <!-- 결과 -->
      <SectionBlock
        v-if="data && data.items.length > 0"
        :heading="`${pageHeading} 목록`"
        subtext="감정가·최저가와 입찰 마감일을 확인하세요."
      >
        <template #right>
          <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {{ data.total.toLocaleString('ko-KR') }}건
          </span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AuctionCard v-for="item in data.items" :key="item.cltrMngNo" :item="item" />
        </div>
        <Pagination
          :current-page="currentPage"
          :total-pages="data.totalPages"
          @page-change="onPageChange"
        />
      </SectionBlock>

      <SectionBlock v-else-if="data && data.items.length === 0" :heading="`${pageHeading} 목록`">
        <EmptyState icon="gavel" title="조회된 공매 물건이 없습니다" description="필터를 변경하거나 전체 목록을 확인해 보세요.">
          <div class="flex items-center justify-center gap-3">
            <button
              v-if="hasActiveFilter"
              class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
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

      <SectionBlock v-else :heading="`${pageHeading} 목록`">
        <div class="rounded-xl bg-background-light p-12 text-center">
          <p class="text-muted text-sm">데이터를 불러오는 중입니다.</p>
        </div>
      </SectionBlock>

      <DataSourceSection domain="auction" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 전역 TrustLine 억제 — 이 페이지는 자체 데이터 출처 카드를 렌더한다 (#766)
definePageMeta({ hasSourceCard: true })

import { computed, nextTick } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { useAuction } from '~/composables/useAuction'
import { buildAuctionListTitle, buildAuctionListHeading } from '~/utils/auctionHead'
import { SITE_URL } from '~/utils/seoConstants'
import { useStructuredData } from '~/composables/useStructuredData'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import AuctionFilters from '~/components/auction/AuctionFilters.vue'
import Pagination from '~/components/common/Pagination.vue'
import PageHero from '~/components/common/PageHero.vue'
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

// noindex for arbitrary filter combos (only base list and ?usage= are indexed)
const isIndexable = computed(() => {
  const q = route.query
  const keys = Object.keys(q).filter((k) => q[k] !== '' && q[k] != null)
  const nonIndexableKeys = keys.filter((k) => !['usage'].includes(k))
  return nonIndexableKeys.length === 0
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

const { data } = await useAsyncData(
  `auction-list-${usage.value}-${filterStatus.value}-${filterCity.value}-${filterDistrict.value}-${currentPage.value}`,
  async () => {
    try {
      return await auction.getItems({
        usage: usage.value || undefined,
        status: filterStatus.value || undefined,
        city: filterCity.value || undefined,
        district: filterDistrict.value || undefined,
        page: currentPage.value,
        limit: 20,
      })
    } catch {
      return null
    }
  },
  // ⚠️ 쿼리파라미터 필터/페이지는 같은 페이지에서 바뀌므로(컴포넌트 unmount 안 됨)
  //    watch 없으면 재요청이 안 일어나 필터·페이징이 전부 죽는다.
  { watch: [usage, filterStatus, filterCity, filterDistrict, currentPage], default: () => null },
)

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
  !!(usage.value || filterStatus.value || filterCity.value || filterDistrict.value),
)

function resetFilters() {
  router.push({ query: {} })
}

const selfUrl = computed(() => {
  const base = `${SITE_URL}/auction/list`
  return usage.value ? `${base}?usage=${usage.value}` : base
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
  return {
    title,
    meta,
    ...(isIndexable.value ? { link: [{ rel: 'canonical', href: selfUrl.value }] } : {}),
  }
})
</script>
