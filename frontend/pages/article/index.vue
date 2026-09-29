<template>
  <div class="min-h-screen bg-white text-strong">
    <main class="mx-auto max-w-[1200px] px-5 pb-16 pt-6 md:px-8">
      <Breadcrumb :items="breadcrumbItems" />
      <header class="pb-8 pt-7 md:pb-10">
        <p class="mb-3 text-sm font-semibold text-primary">생활 정보</p>
        <h1 class="text-[28px] font-bold leading-tight md:text-[36px]">오늘의 이슈</h1>
        <p class="mt-4 text-sm leading-6 text-muted">부동산·청약·생활시설의 최신 소식과 정책 변화를 확인하세요.</p>
      </header>
      <nav aria-label="주제 선택" class="flex flex-wrap gap-2 border-b border-line pb-6">
        <button v-for="topic in CONTENT_TOPICS" :key="topic.key" type="button" :aria-pressed="filters.topic === topic.key" class="min-h-11 rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" :class="filters.topic === topic.key ? 'border-primary bg-primary text-white' : 'border-line text-muted hover:border-primary hover:text-primary'" @click="selectTopic(topic.key)">{{ topic.label }}</button>
      </nav>
      <section aria-label="이슈 목록" class="min-w-0 pt-7">
        <div v-if="loading" role="status" class="py-16 text-center text-muted">불러오는 중입니다.</div>
        <div v-else-if="listError" role="alert" class="py-16 text-center">
          <p class="text-muted">이슈를 불러오지 못했습니다. 다시 시도해 주세요.</p>
          <button type="button" class="mt-4 min-h-11 rounded-md border border-line px-5 text-sm font-semibold text-primary" @click="refresh()">다시 시도</button>
        </div>
        <template v-else>
          <p class="mb-4 text-sm text-muted">전체 {{ totalCount.toLocaleString('ko-KR') }}건 · 최신순</p>

          <div v-if="items.length" class="min-w-0">
            <ContentListRow v-for="item in presentation.rows" :key="item.id" kind="article" :item="item" />
          </div>
          <div v-else class="py-16 text-center text-muted">해당 주제의 이슈가 아직 없습니다.</div>
          <AdBanner class="mt-6" />
          <Pagination class="flex-wrap" :current-page="filters.page" :total-pages="totalPages" :href-for="pageHref" @page-change="goToPage" />
        </template>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { useArticles } from '~/composables/useArticles'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { suppressAds } from '~/composables/useAdsPolicy'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CONTENT_TOPICS, normalizeContentListQuery, contentListQuery, contentListRequest, contentListHref, type ContentTopic } from '~/utils/contentListQuery'
import { splitFeatured } from '~/utils/contentListPresentation'
import { SITE_URL } from '~/utils/seoConstants'
import ContentListRow from '~/components/guide/ContentListRow.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import Pagination from '~/components/common/Pagination.vue'

const route = useRoute()
const router = useRouter()
const filters = computed(() => normalizeContentListQuery(route.query))
const key = computed(() => `article-list:${filters.value.topic}:${filters.value.page}`)
const { fetchArticles } = useArticles()
const { data, status, error: listError, refresh } = await useAsyncData(key, () => fetchArticles(contentListRequest(filters.value)))
if (import.meta.server && listError.value) markDegradedResponse()
const loading = computed(() => status.value === 'pending')
const items = computed(() => data.value?.items ?? [])
const totalCount = computed(() => data.value?.total ?? 0)
const totalPages = computed(() => data.value?.totalPages ?? 1)
const presentation = computed(() => splitFeatured(items.value, filters.value.page, false))
const filtered = computed(() => !!filters.value.topic || filters.value.page > 1)
const { setMeta } = useFacilityMeta()
setMeta({ title: '오늘의 이슈 | 일상킷', description: '부동산, 청약, 병원, 약국, 주차장 등 생활 관련 오늘의 이슈를 확인하세요.', path: '/article', canonical: false })
useHead(() => ({
  meta: [{ name: 'robots', content: filtered.value ? 'noindex, follow' : 'index, follow' }],
  link: filtered.value ? [] : [{ rel: 'canonical', key: 'canonical', href: `${SITE_URL}/article` }],
}))
watchEffect(() => suppressAds(filtered.value || !!listError.value || loading.value))
const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([{ name: '홈', url: '/' }, { name: '오늘의 이슈', url: '/article' }])
watchEffect(() => setItemListSchema(items.value.map((item, index) => ({ name: item.title, url: `/article/${item.slug}`, position: (filters.value.page - 1) * 12 + index + 1 }))))
const breadcrumbItems = [{ label: '홈', href: '/', current: false }, { label: '오늘의 이슈', href: '/article', current: true }]
function selectTopic(topic: ContentTopic) { return router.push({ query: contentListQuery({ topic, page: 1 }) }) }
function goToPage(page: number) { return router.push({ query: contentListQuery({ ...filters.value, page }) }) }
function pageHref(page: number) { return contentListHref('article', { ...filters.value, page }) }

</script>
