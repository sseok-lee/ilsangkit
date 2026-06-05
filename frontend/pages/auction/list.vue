<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <PageHero
        eyebrow="공매"
        :title="pageTitle"
        :description="`온비드 부동산 공매 물건을 지역·용도·상태별로 조회하세요.`"
      />

      <!-- 필터 -->
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

      <!-- 결과 -->
      <div v-if="data && data.items.length > 0">
        <p class="text-caption text-slate-500 mb-3">총 {{ data.total.toLocaleString('ko-KR') }}건</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <AuctionCard v-for="item in data.items" :key="item.cltrMngNo" :item="item" />
        </div>
        <Pagination
          :current-page="currentPage"
          :total-pages="data.totalPages"
          @page-change="onPageChange"
        />
      </div>
      <div v-else-if="data && data.items.length === 0" class="rounded-xl bg-slate-50 p-12 text-center">
        <p class="text-slate-700 font-semibold">조회된 공매 물건이 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">필터를 변경하거나 나중에 다시 확인해 주세요.</p>
      </div>
      <div v-else class="rounded-xl bg-slate-50 p-12 text-center">
        <p class="text-slate-500 text-sm">데이터를 불러오는 중입니다.</p>
      </div>

      <AdBanner />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuction } from '~/composables/useAuction'
import { buildAuctionListTitle } from '~/utils/auctionHead'
import { SITE_URL } from '~/utils/seoConstants'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import AuctionFilters from '~/components/auction/AuctionFilters.vue'
import Pagination from '~/components/common/Pagination.vue'
import PageHero from '~/components/common/PageHero.vue'

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

const pageTitle = computed(() => buildAuctionListTitle(usage.value))

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

function onUsage(v: string) {
  router.push({ query: { ...route.query, usage: v || undefined, page: undefined } })
}
function onStatus(v: string) {
  router.push({ query: { ...route.query, status: v || undefined, page: undefined } })
}
function onCity(v: string) {
  router.push({ query: { ...route.query, city: v || undefined, district: undefined, page: undefined } })
}
function onDistrict(v: string) {
  router.push({ query: { ...route.query, district: v || undefined, page: undefined } })
}
function onPageChange(p: number) {
  router.push({ query: { ...route.query, page: p === 1 ? undefined : p } })
}

const selfUrl = computed(() => {
  const base = `${SITE_URL}/auction/list`
  return usage.value ? `${base}?usage=${usage.value}` : base
})

useHead(() => {
  const title = pageTitle.value
  const description = `온비드 부동산 공매 물건을 지역·용도·상태별로 조회하세요.`
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfUrl.value },
  ]
  if (!isIndexable.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  return {
    title,
    meta,
    ...(isIndexable.value ? { link: [{ rel: 'canonical', href: selfUrl.value }] } : {}),
  }
})
</script>
