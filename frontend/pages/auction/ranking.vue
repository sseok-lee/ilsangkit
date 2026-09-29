<template>
  <div class="property-redesign bg-white min-h-screen">
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        class="property-hero"
        eyebrow="공매"
        title="지역별 낙찰가율 랭킹"
        description="지역별·용도별 공매 낙찰가율 통계를 확인하세요. 온비드 공식 데이터 기반."
      />

      <!-- 용도/정렬 토글 -->
      <SectionBlock class="property-section" heading="용도·정렬" subtext="용도를 고르고 정렬 기준을 바꿔 랭킹을 확인하세요.">
        <form class="mb-4 flex flex-wrap gap-2" @submit.prevent="submitKeyword">
          <label class="sr-only" for="auction-ranking-keyword">지역명 검색</label>
          <input id="auction-ranking-keyword" v-model="keywordDraft" maxlength="100" placeholder="시·도 또는 구·군" class="min-h-[44px] min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm">
          <button type="submit" class="min-h-[44px] rounded-lg bg-primary px-4 text-sm font-semibold text-white">검색</button>
        </form>
        <div class="flex flex-wrap gap-2">
          <select
            v-model="selectedUsage"
            aria-label="용도"
            class="min-h-[44px] max-w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="">전체 용도</option>
            <option v-for="[k, v] in usageOptions" :key="k" :value="k">{{ v }}</option>
          </select>
          <select
            v-model="selectedOrder"
            aria-label="정렬 기준"
            class="min-h-[44px] max-w-full rounded-lg border border-line px-3 py-2 text-sm"
          >
            <option value="high">낙찰가율 높은 순</option>
            <option value="low">낙찰가율 낮은 순</option>
            <option value="count">낙찰 건수 많은 순</option>
          </select>
        </div>
      </SectionBlock>

      <!-- 랭킹 테이블 -->
      <SectionBlock class="property-section" heading="지역별 낙찰가율" :subtext="`조건에 맞는 상위 ${rows?.length ?? 0}개 지역·용도 · 감정가 대비 낙찰가 비율`">
        <div v-if="rankingError" role="alert" class="py-8 text-center">
          <p class="text-sm text-slate-600">랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p>
          <button type="button" class="mt-3 min-h-[44px] rounded-lg border border-line px-4 text-sm" @click="refresh()">다시 시도</button>
        </div>
        <p v-else-if="pending" role="status" class="py-8 text-center text-sm text-slate-600">랭킹을 불러오는 중입니다.</p>
        <AuctionRankingTable v-else-if="rows && rows.length > 0" :rows="rows" />
        <EmptyState
          v-else
          icon="gavel"
          title="낙찰 데이터가 없습니다"
          description="데이터가 충분히 쌓이면 랭킹이 표시됩니다."
        >
          <NuxtLink
            to="/auction"
            class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            전체 공매 보기
          </NuxtLink>
        </EmptyState>
      </SectionBlock>

      <AdBanner />


      <DataSourceSection domain="auction" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { suppressAds } from '~/composables/useAdsPolicy'
import { useAuction } from '~/composables/useAuction'
import { USAGE_GROUP_LABEL } from '~/types/auction'
import { useStructuredData } from '~/composables/useStructuredData'
import { isListingDocumentIndexable } from '~/utils/indexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import AuctionRankingTable from '~/components/auction/AuctionRankingTable.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import EmptyState from '~/components/common/EmptyState.vue'

const auction = useAuction()

const route = useRoute()
const router = useRouter()
const queryText = (value: unknown) => typeof value === 'string' ? value : ''
const selectedUsage = computed({
  get: () => queryText(route.query.usage),
  set: (value: string) => { router.push({ query: { ...route.query, usage: value || undefined } }) },
})
const selectedOrder = computed({
  get: () => queryText(route.query.order) || 'high',
  set: (value: string) => { router.push({ query: { ...route.query, order: value === 'high' ? undefined : value } }) },
})
const keyword = computed(() => queryText(route.query.q).trim())
const keywordDraft = ref(keyword.value)
watch(keyword, value => { keywordDraft.value = value })
function submitKeyword() {
  router.push({ query: { ...route.query, q: keywordDraft.value.trim() || undefined } })
}

const usageOptions = computed(() =>
  Object.entries(USAGE_GROUP_LABEL) as [string, string][],
)

// ⚠️ 여기서 try/catch 로 [] 를 반환하면 안 된다.
// 예전 코드가 그랬고, 그래서 "백엔드 장애"와 "아직 낙찰 데이터가 없음"이 호출부에서
// 완전히 같은 모양(빈 배열)이 됐다. 아래 색인 판정이 그 둘을 구분해야 하므로
// 실패는 삼키지 않고 error 로 올린다. 실패해도 default 가 [] 라 본문은 그대로 렌더된다.
const dataKey = computed(() => `auction-ranking-${JSON.stringify([keyword.value, selectedUsage.value, selectedOrder.value])}`)
const { data: rows, error: rankingError, pending, refresh } = await useAsyncData(
  dataKey,
  () => auction.getRanking({ keyword: keyword.value || undefined, usage: selectedUsage.value || undefined, order: selectedOrder.value, limit: 50 }),
  { default: () => [] },
)

const rankingFetchFailed = computed(() => !!rankingError.value)

// 일시 장애는 503 + no-store 로만 알린다(fail-open, #467). 404 나 영구 noindex 로 굳히지 않는다.
if (import.meta.server && rankingFetchFailed.value) {
  markDegradedResponse()
}

// 소프트 404 차단 — 2026-09-04 실측: 이 페이지는 낙찰 데이터가 0건인데도
// HTTP 200 + index,follow + self-canonical 로 나가 본문이 "낙찰 데이터가 없습니다" 한 줄뿐이었다.
// 판정은 요청 시점 행 수로 하므로, 데이터가 쌓이면 다음 요청부터 자동으로 색인 대상이 된다
// (수동 플래그·재배포 불필요). fetch 실패는 fail-open 이라 장애가 색인을 떨어뜨리지 않는다.
const rankingIndexable = computed(() =>
  Object.keys(route.query).length === 0 && isListingDocumentIndexable({ itemCount: rows.value?.length, fetchFailed: rankingFetchFailed.value }),
)

watchEffect(() => suppressAds(!rankingIndexable.value || rankingFetchFailed.value || !!pending.value || !rows.value?.length))

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '공매', href: '/auction', current: false },
  { label: '낙찰가율 랭킹', href: '/auction/ranking', current: true },
]

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공매', url: '/auction' },
  { name: '낙찰가율 랭킹', url: '/auction/ranking' },
])

const rankingDescription = '지역별·용도별 공매 낙찰가율 통계를 확인하세요. 온비드 공식 데이터 기반.'

const rankingTitle = '지역별 낙찰가율 랭킹 | 공매 | 일상킷'
const rankingUrl = `${SITE_URL}/auction/ranking`

// 정적 객체가 아니라 함수형 useHead 여야 한다 — robots/canonical 이 데이터에 반응해야
// 행이 생긴 순간(클라이언트 refresh 포함) 색인 가능 상태로 바뀐다.
useHead(() => {
  // og:image 는 색인 여부와 무관한 소셜 공유 신호라 noindex 여도 유지한다.
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: rankingDescription },
    { property: 'og:title', content: rankingTitle },
    { property: 'og:description', content: rankingDescription },
    { property: 'og:url', content: rankingUrl },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: rankingTitle },
    { name: 'twitter:description', content: rankingDescription },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ]

  if (!rankingIndexable.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }

  // noindex-canonical-policy: noindex 페이지는 canonical 을 함께 내보내지 않는다(혼합 신호 방지).
  return {
    title: rankingTitle,
    meta,
    link: rankingIndexable.value ? [{ rel: 'canonical', href: rankingUrl }] : [],
  }
})
</script>

<style src="~/assets/css/remaining-property.css"></style>
