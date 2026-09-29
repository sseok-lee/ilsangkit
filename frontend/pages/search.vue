<template>
  <main class="search-page">
    <div class="search-page__inner">
      <section class="search-hero" aria-labelledby="search-title">
        <h1 id="search-title">어떤 곳을 찾으세요?</h1>
        <form class="search-form" role="search" @submit.prevent="submitSearch">
          <span class="material-symbols-outlined search-form__icon" aria-hidden="true">search</span>
          <input v-model="draft" aria-label="통합 검색" type="search" placeholder="장소·단지명·시설명 검색" />
          <button v-if="draft" type="button" class="search-form__clear" aria-label="검색어 지우기" @click="clearDraft">
            <span class="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
          <button type="submit" class="search-form__submit">검색</button>
        </form>
        <p v-if="applied.q" class="search-summary" aria-live="polite">
          ‘{{ applied.q }}’ 검색 결과에서
          <template v-if="successfulDomainCount">{{ successfulSummary }} 찾았습니다.</template>
          <template v-else-if="overviewPending">결과를 찾고 있습니다.</template>
          <template v-else>확인 가능한 결과가 없습니다.</template>
        </p>
        <p v-else class="search-summary">장소·단지명·시설명을 함께 검색할 수 있습니다.</p>
      </section>

      <nav class="search-tabs" aria-label="검색 결과 영역">
        <NuxtLink
          v-for="tab in tabs"
          :key="tab.value"
          :to="tab.href"
          class="search-tab"
          :class="{ 'search-tab--active': applied.tab === tab.value }"
          :aria-current="applied.tab === tab.value ? 'page' : undefined"
        >
          {{ tab.label }}
          <span v-if="tab.count !== null">{{ tab.count.toLocaleString('ko-KR') }}</span>
        </NuxtLink>
      </nav>

      <div class="search-layout">
        <div class="search-results" aria-live="polite">
          <EmptyState v-if="!applied.q" title="검색어를 입력해 주세요" description="장소·단지명·시설명으로 검색해보세요" />

          <template v-else>
            <section v-if="showBuildings" class="domain-section" aria-labelledby="building-results-title">
              <header class="domain-section__header">
                <h2 id="building-results-title">부동산</h2>
                <span v-if="displayedBuildingCount !== null">{{ displayedBuildingCount.toLocaleString('ko-KR') }}곳</span>
              </header>

              <template v-if="activeProperty">
                <div v-if="propertyResults.status === 'pending'" class="result-skeleton" aria-busy="true">
                  <span v-for="i in 3" :key="i" />
                </div>
                <div v-else-if="propertyResults.status === 'error'" class="domain-message" role="alert">
                  <p>{{ propertyResults.error }}</p>
                  <button type="button" @click="retryDomain('property')">다시 시도</button>
                </div>
                <template v-else-if="propertyResults.status === 'success' && propertyResults.data?.items.length">
                  <div class="result-rows">
                    <ExplorationBuildingRow
                      v-for="building in propertyResults.data.items"
                      :key="building.buildingKey ?? `${building.buildingName}:${building.bjdCode}:${building.dongName}:${building.jibun ?? ''}`"
                      :building="building"
                      mode="representative"
                    />
                  </div>
                  <nav v-if="propertyResults.data.totalPages > 1" class="search-pagination" aria-label="부동산 검색 페이지">
                    <NuxtLink v-if="activePropertyPage > 1" :to="propertyPageHref(activePropertyPage - 1)" class="search-pagination__link" aria-label="이전 페이지" aria-current="false">
                      이전
                    </NuxtLink>
                    <template v-for="item in propertyPaginationItems" :key="item">
                      <span v-if="typeof item === 'string'" class="search-pagination__ellipsis" aria-hidden="true">…</span>
                      <NuxtLink
                        v-else
                        :to="propertyPageHref(item)"
                        class="search-pagination__link search-pagination__page"
                        :class="{ 'search-pagination__page--current': item === activePropertyPage }"
                        :aria-label="`${item} 페이지`"
                        :aria-current="item === activePropertyPage ? 'page' : undefined"
                      >
                        {{ item }}
                      </NuxtLink>
                    </template>
                    <NuxtLink v-if="activePropertyPage < propertyResults.data.totalPages" :to="propertyPageHref(activePropertyPage + 1)" class="search-pagination__link" aria-label="다음 페이지" aria-current="false">다음</NuxtLink>
                  </nav>
                </template>
                <p v-else-if="propertyResults.status === 'success'" class="domain-empty">이 유형의 검색 결과가 없습니다.</p>
              </template>

              <template v-else>
                <div v-if="buildings.status === 'pending'" class="result-skeleton" aria-busy="true">
                  <span v-for="i in 3" :key="i" />
                </div>
                <div v-else-if="buildings.status === 'error'" class="domain-message" role="alert">
                  <p>{{ buildings.error }}</p>
                  <button type="button" @click="retryDomain('buildings')">다시 시도</button>
                </div>
                <template v-else-if="buildings.status === 'success'">
                  <SearchResultGroup
                    v-for="group in visibleBuildingGroups"
                    :key="group.property"
                    :label="group.label"
                    :count="group.count"
                    count-unit="곳"
                    layout="rows"
                    more-label="전체 보기"
                    :more-href="buildingMoreHref(group.property)"
                  >
                    <ExplorationBuildingRow
                      v-for="building in group.items"
                      :key="building.buildingKey ?? `${building.buildingName}:${building.bjdCode}:${building.dongName}:${building.jibun ?? ''}`"
                      :building="building"
                      mode="representative"
                    />
                  </SearchResultGroup>
                  <p v-if="!visibleBuildingGroups.length" class="domain-empty">부동산 검색 결과가 없습니다.</p>
                </template>
              </template>
            </section>

            <section v-if="showFacilities" class="domain-section" aria-labelledby="facility-results-title">
              <header class="domain-section__header">
                <h2 id="facility-results-title">생활시설</h2>
                <span v-if="facilityCount !== null">{{ facilityCount.toLocaleString('ko-KR') }}곳</span>
                <span v-if="facilities.status === 'success'" class="domain-section__note">전체 결과 기준 · 카테고리별 최대 3개 미리보기</span>
              </header>

              <nav v-if="applied.tab === 'facilities' && facilities.status === 'success' && facilityFilterOptions.length" class="facility-filters" aria-label="생활시설 카테고리">
                <NuxtLink :to="facilityCategoryHref(null)" class="facility-filter" :class="{ 'facility-filter--active': !applied.facilityCategory }" :aria-current="!applied.facilityCategory ? 'page' : undefined">전체 카테고리</NuxtLink>
                <NuxtLink
                  v-for="group in facilityFilterOptions"
                  :key="group.category"
                  :to="facilityCategoryHref(group.category)"
                  class="facility-filter"
                  :class="{ 'facility-filter--active': applied.facilityCategory === group.category }"
                  :aria-current="applied.facilityCategory === group.category ? 'page' : undefined"
                >
                  {{ group.label }} {{ group.count.toLocaleString('ko-KR') }}
                </NuxtLink>
              </nav>

              <div v-if="facilities.status === 'pending'" class="result-skeleton" aria-busy="true">
                <span v-for="i in 3" :key="i" />
              </div>
              <div v-else-if="facilities.status === 'error'" class="domain-message" role="alert">
                <p>{{ facilities.error }}</p>
                <button type="button" @click="retryDomain('facilities')">다시 시도</button>
              </div>
              <template v-else-if="facilities.status === 'success'">
                <SearchResultGroup
                  v-for="group in visibleFacilityGroups"
                  :key="group.category"
                  :label="group.label"
                  :count="group.count"
                  :count-unit="group.unit ?? '곳'"
                  layout="rows"
                  more-label="전체 보기"
                  :cat-category="group.category"
                  :more-href="`/${group.category}?keyword=${encodeURIComponent(applied.q)}`"
                >
                  <FacilitySearchRow
                    v-for="facility in group.items.slice(0, 3)"
                    :key="`${facility.category}:${facility.id}`"
                    :facility="facility"
                  />
                </SearchResultGroup>
                <p v-if="!visibleFacilityGroups.length" class="domain-empty">생활시설 검색 결과가 없습니다.</p>
              </template>
            </section>

            <AdBanner v-if="hasSuccessfulResults" class="search-ad" />
            <EmptyState v-if="showCombinedEmpty" title="검색 결과가 없어요" description="다른 장소·단지명·시설명으로 검색해보세요" />
          </template>
        </div>

        <aside class="search-aside" aria-label="지역 탐색 안내">
          <h2>지역으로 살펴보기</h2>
          <p>이름이 떠오르지 않는다면 지도에서 주변을 둘러보세요.</p>
          <NuxtLink to="/real-estate">부동산 지도 <span aria-hidden="true">⌘</span></NuxtLink>
          <NuxtLink to="/seoul/gangnam">강남구 생활정보 <span aria-hidden="true">☷</span></NuxtLink>
          <small>실거래 가격은 계약일·면적·층에 따라 다릅니다. 세부 조건은 각 건물 상세에서 확인하세요.</small>
        </aside>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import EmptyState from '~/components/common/EmptyState.vue'
import ExplorationBuildingRow from '~/components/realEstate/ExplorationBuildingRow.vue'
import FacilitySearchRow from '~/components/search/FacilitySearchRow.vue'
import SearchResultGroup from '~/components/search/SearchResultGroup.vue'
import { useAnalytics } from '~/composables/useAnalytics'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useSearchSuggest } from '~/composables/useSearchSuggest'
import { useUnifiedSearch } from '~/composables/useUnifiedSearch'
import { FACILITY_CATEGORIES, isFacilityCategory, type FacilityCategory, type GroupedCategory } from '~/types/facility'
import type { ComplexInfo, RealEstatePropertyType, RealEstateType } from '~/types/realEstate'
import { parseUnifiedSearchQuery, toUnifiedSearchQuery } from '~/utils/unifiedSearchQuery'

const route = useRoute()
const { buildings, facilities, propertyResults, search, loadProperty, retry, clear } = useUnifiedSearch()
const { setSearchMeta } = useFacilityMeta()
const { trackSearchResultsView, trackSearchNoResults } = useAnalytics()
const { logSearch } = useSearchSuggest()

const applied = computed(() => parseUnifiedSearchQuery(route.query))
const draft = ref(applied.value.q)
const mounted = ref(false)
const showBuildings = computed(() => applied.value.tab !== 'facilities')
const showFacilities = computed(() => applied.value.tab !== 'buildings')
const activeProperty = computed(() => applied.value.tab === 'buildings' ? applied.value.property : null)
const activePropertyPage = computed(() => activeProperty.value ? applied.value.page : 1)
const activeFacilityCategory = computed(() => applied.value.tab === 'facilities' ? applied.value.facilityCategory : null)

const buildingCount = computed<number | null>(() => {
  if (buildings.value.status !== 'success') return null
  const counts = buildings.value.data?.buildingCounts
  return counts ? counts.apt + counts.villa + counts.offitel : 0
})
const facilityCount = computed<number | null>(() => facilities.value.status === 'success' ? facilities.value.data?.totalCount ?? 0 : null)
const propertyCount = computed<number | null>(() => propertyResults.value.status === 'success' ? propertyResults.value.data?.total ?? 0 : null)
const displayedBuildingCount = computed(() => activeProperty.value ? propertyCount.value : buildingCount.value)
const combinedOverviewCount = computed<number | null>(() => (
  buildingCount.value !== null && facilityCount.value !== null
    ? buildingCount.value + facilityCount.value
    : null
))
const successfulDomainCount = computed(() => Number(buildings.value.status === 'success') + Number(facilities.value.status === 'success'))
const overviewPending = computed(() => buildings.value.status === 'pending' || facilities.value.status === 'pending')
const successfulSummary = computed(() => {
  const parts: string[] = []
  if (buildingCount.value !== null) parts.push(`부동산 ${buildingCount.value.toLocaleString('ko-KR')}곳`)
  if (facilityCount.value !== null) parts.push(`생활시설 ${facilityCount.value.toLocaleString('ko-KR')}곳`)
  return parts.join(', ')
})

const PROPERTY_META: Array<{ property: RealEstatePropertyType; label: string }> = [
  { property: 'apt', label: '아파트' },
  { property: 'villa', label: '빌라' },
  { property: 'offitel', label: '오피스텔' },
]
type SearchPreview = ComplexInfo & { type: RealEstateType }

const visibleBuildingGroups = computed(() => {
  const data = buildings.value.status === 'success' ? buildings.value.data : null
  if (!data) return []
  return PROPERTY_META.map(({ property, label }) => {
    const seen = new Set<string>()
    const items: SearchPreview[] = []
    for (const category of data.categories as unknown as Array<{ type: RealEstateType; items: SearchPreview[] }>) {
      if (!category.type.startsWith(`${property}-`)) continue
      for (const item of category.items) {
        const key = item.buildingKey ?? `${item.buildingName}|${item.bjdCode}|${item.dongName}|${item.jibun ?? ''}`
        if (seen.has(key)) continue
        seen.add(key)
        items.push({ ...item, type: category.type })
        if (items.length === 3) break
      }
      if (items.length === 3) break
    }
    return { property, label, count: data.buildingCounts?.[property] ?? 0, items }
  }).filter(group => group.count > 0)
})

const categoryOrder = new Map<FacilityCategory, number>(FACILITY_CATEGORIES.map((category, index) => [category, index]))
const facilityFilterOptions = computed<GroupedCategory[]>(() => {
  if (facilities.value.status !== 'success') return []
  return [...(facilities.value.data?.categories ?? [])]
    .filter(group => group.count > 0)
    .sort((a, b) => b.count - a.count || (categoryOrder.get(a.category) ?? 99) - (categoryOrder.get(b.category) ?? 99))
})
const visibleFacilityGroups = computed(() => facilityFilterOptions.value.filter(group => !activeFacilityCategory.value || group.category === activeFacilityCategory.value))

const tabs = computed(() => [
  { value: 'all' as const, label: '전체', count: combinedOverviewCount.value, href: { path: '/search', query: toUnifiedSearchQuery({ ...applied.value, tab: 'all', property: null, page: 1, facilityCategory: null }) } },
  { value: 'buildings' as const, label: '부동산', count: buildingCount.value, href: { path: '/search', query: toUnifiedSearchQuery({ ...applied.value, tab: 'buildings', property: null, page: 1, facilityCategory: null }) } },
  { value: 'facilities' as const, label: '생활시설', count: facilityCount.value, href: { path: '/search', query: toUnifiedSearchQuery({ ...applied.value, tab: 'facilities', property: null, page: 1, facilityCategory: applied.value.tab === 'facilities' ? activeFacilityCategory.value : null }) } },
])

const currentSuccessfulTotal = computed(() => {
  if (applied.value.tab === 'buildings') return activeProperty.value ? propertyCount.value : buildingCount.value
  if (applied.value.tab === 'facilities') {
    if (facilities.value.status !== 'success') return null
    if (!activeFacilityCategory.value) return facilityCount.value
    return facilityFilterOptions.value.find(group => group.category === activeFacilityCategory.value)?.count ?? 0
  }
  return combinedOverviewCount.value
})
const hasSuccessfulResults = computed(() => (currentSuccessfulTotal.value ?? 0) > 0)
const showCombinedEmpty = computed(() => {
  if (!applied.value.q || hasSuccessfulResults.value) return false
  if (applied.value.tab === 'buildings' && activeProperty.value) return propertyResults.value.status === 'success' && propertyCount.value === 0
  if (applied.value.tab === 'buildings') return buildings.value.status === 'success' && buildingCount.value === 0
  if (applied.value.tab === 'facilities') return facilities.value.status === 'success' && facilityCount.value === 0
  return buildings.value.status === 'success' && facilities.value.status === 'success' && currentSuccessfulTotal.value === 0
})

type PropertyPaginationItem = number | 'start-ellipsis' | 'end-ellipsis'
const propertyPaginationItems = computed<PropertyPaginationItem[]>(() => {
  const total = propertyResults.value.data?.totalPages ?? 0
  const current = activePropertyPage.value
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)
  if (current <= 3) return [1, 2, 3, 'end-ellipsis', total]
  if (current >= total - 2) return [1, 'start-ellipsis', total - 2, total - 1, total]
  return [1, 'start-ellipsis', current, 'end-ellipsis', total]
})

async function submitSearch() {
  const q = draft.value.trim()
  if (q === applied.value.q) {
    await retryFailedDomains()
    return
  }
  await navigateTo({ path: '/search', query: toUnifiedSearchQuery({ q, tab: applied.value.tab, property: null, page: 1, facilityCategory: null }) })
}

async function clearDraft() {
  draft.value = ''
  await submitSearch()
}

async function retryFailedDomains() {
  const tasks: Promise<void>[] = []
  if (buildings.value.status === 'error') tasks.push(retry('buildings'))
  if (facilities.value.status === 'error') tasks.push(retry('facilities'))
  if (activeProperty.value && propertyResults.value.status === 'error') tasks.push(retry('property'))
  if (tasks.length) await Promise.all(tasks)
}

function retryDomain(domain: 'buildings' | 'facilities' | 'property') { return retry(domain) }
function buildingMoreHref(property: RealEstatePropertyType) { return { path: '/search', query: toUnifiedSearchQuery({ ...applied.value, tab: 'buildings', property, page: 1, facilityCategory: null }) } }
function propertyPageHref(page: number) {
  const query = toUnifiedSearchQuery({ q: applied.value.q, tab: 'buildings', property: activeProperty.value, page, facilityCategory: null })
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === 'string') params.set(key, value)
  }
  return `/search?${params.toString()}`
}
function facilityCategoryHref(facilityCategory: FacilityCategory | null) { return { path: '/search', query: toUnifiedSearchQuery({ ...applied.value, tab: 'facilities', property: null, page: 1, facilityCategory }) } }

function recordSearch(q: string) {
  if (
    applied.value.q !== q
    || buildings.value.status !== 'success'
    || facilities.value.status !== 'success'
    || buildings.value.keyword !== q
    || facilities.value.keyword !== q
  ) return
  const resultCount = (buildingCount.value ?? 0) + (facilityCount.value ?? 0)
  const payload = { keyword: q, resultCount, category: 'unified' }
  trackSearchResultsView(payload)
  logSearch(payload)
  if (resultCount === 0) trackSearchNoResults({ keyword: q })
}

let overviewRequestSequence = 0
async function runOverview(q: string) {
  const requestSequence = ++overviewRequestSequence
  if (!q) { clear(); return }
  await search(q)
  if (requestSequence !== overviewRequestSequence) return
  recordSearch(q)
}

async function loadAppliedProperty() {
  if (activeProperty.value && applied.value.q) await loadProperty(applied.value.q, activeProperty.value, activePropertyPage.value)
}

onScopeDispose(() => { overviewRequestSequence++ })

const redirectCategory = Array.isArray(route.query.category) ? route.query.category[0] : route.query.category
if (redirectCategory && isFacilityCategory(String(redirectCategory))) {
  const qValue = Object.hasOwn(route.query, 'q') ? route.query.q : route.query.keyword
  const keyword = Array.isArray(qValue) ? qValue[0] : qValue
  const suffix = typeof keyword === 'string' && keyword.trim() ? `?keyword=${encodeURIComponent(keyword.trim())}` : ''
  navigateTo(`/${redirectCategory}${suffix}`, { replace: true, redirectCode: 301 })
}

useHead(() => ({
  title: applied.value.q ? `${applied.value.q} 검색 결과 | 일상킷` : '검색 | 일상킷',
  meta: [
    { name: 'robots', content: 'noindex, follow' },
    { name: 'description', content: applied.value.q ? `${applied.value.q} 관련 생활시설·부동산 정보를 찾아보세요.` : '장소·단지명·시설명으로 생활시설과 부동산을 검색하세요.' },
  ],
}))

watch(() => applied.value.q, async (q, previous) => {
  draft.value = q
  setSearchMeta({ keyword: q || undefined })
  if (!mounted.value || q === previous) return
  await runOverview(q)
})

watch(() => [applied.value.q, applied.value.tab, activeProperty.value, activePropertyPage.value] as const, async ([q, tab, property, page], [previousQ, previousTab, previousProperty, previousPage]) => {
  if (!mounted.value || (q === previousQ && tab === previousTab && property === previousProperty && page === previousPage)) return
  if (tab === 'buildings' && property && q) await loadProperty(q, property, page)
})

onMounted(async () => {
  mounted.value = true
  draft.value = applied.value.q
  setSearchMeta({ keyword: applied.value.q || undefined })
  if (!applied.value.q) { clear(); return }
  await Promise.all([runOverview(applied.value.q), loadAppliedProperty()])
})
</script>

<style scoped>
.search-page { min-height: 100vh; background: #fff; color: #15213b; }
.search-page__inner { width: min(100% - 2rem, 1200px); margin: 0 auto; padding: 2rem 0 4rem; }
.search-hero { max-width: 820px; }
.search-hero h1 { margin: 0 0 1.5rem; font-size: 2.25rem; font-weight: 800; line-height: 1.2; letter-spacing: -0.04em; }
.search-form { display: flex; min-height: 52px; align-items: center; gap: 0.5rem; padding: 0.25rem; border: 1px solid #aeb7c8; border-radius: 0.5rem; background: #fff; }
.search-form:focus-within { border-color: #2450dc; box-shadow: 0 0 0 2px rgb(36 80 220 / 12%); }
.search-form__icon { margin-left: 0.5rem; color: #56627a; font-size: 1.25rem; }
.search-form input { min-width: 0; flex: 1; border: 0; outline: 0; color: #15213b; font: inherit; }
.search-form__clear, .search-form__submit { min-width: 44px; min-height: 44px; border: 0; border-radius: 0.375rem; }
.search-form__clear { display: inline-flex; align-items: center; justify-content: center; background: transparent; color: #56627a; }
.search-form__submit { padding: 0 1rem; background: #2450dc; color: #fff; font-size: 0.875rem; font-weight: 700; }
.search-summary { margin: 0.75rem 0 0; color: #56627a; font-size: 0.8125rem; line-height: 1.5; }
.search-tabs { display: flex; gap: 0.5rem; margin-top: 2rem; border-bottom: 1px solid #e6e9f0; overflow-x: auto; }
.search-tab { position: relative; display: inline-flex; min-height: 44px; align-items: center; gap: 0.375rem; padding: 0 0.375rem; color: #56627a; font-size: 0.875rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
.search-tab span { font-size: 0.75rem; font-variant-numeric: tabular-nums; }
.search-tab--active { color: #2450dc; }
.search-tab--active::after { position: absolute; right: 0; bottom: -1px; left: 0; height: 3px; background: #2450dc; content: ''; }
.search-layout { display: grid; grid-template-columns: minmax(0, 1fr) 260px; gap: 3rem; margin-top: 2rem; }
.search-results { min-width: 0; }
.domain-section + .domain-section { margin-top: 2.5rem; }
.domain-section__header { display: flex; min-height: 44px; flex-wrap: wrap; align-items: baseline; gap: 0.75rem; border-bottom: 1px solid #e6e9f0; }
.domain-section__header h2 { margin: 0; font-size: 1.25rem; font-weight: 800; letter-spacing: -0.025em; }
.domain-section__header span { color: #56627a; font-size: 0.8125rem; font-weight: 600; }
.domain-section__note { margin-left: auto; }
.result-rows { border-top: 1px solid #e6e9f0; }
.result-skeleton { display: grid; }
.result-skeleton span { height: 112px; border-bottom: 1px solid #e6e9f0; background: linear-gradient(90deg, #f7f8fa, #eef0f4, #f7f8fa); background-size: 200% 100%; animation: search-shimmer 1.4s infinite; }
.domain-message, .domain-empty { margin: 0; padding: 2rem 1rem; color: #56627a; text-align: center; }
.domain-message button { min-height: 44px; margin-top: 0.5rem; border: 1px solid #2450dc; border-radius: 0.375rem; padding: 0.5rem 1rem; background: #fff; color: #2450dc; font-weight: 700; }
.facility-filters { display: flex; gap: 0.5rem; padding: 1rem 0; overflow-x: auto; }
.facility-filter { display: inline-flex; min-height: 44px; align-items: center; border: 1px solid #e6e9f0; border-radius: 0.375rem; padding: 0 0.75rem; color: #56627a; font-size: 0.8125rem; font-weight: 700; text-decoration: none; white-space: nowrap; }
.facility-filter--active { border-color: #15213b; background: #15213b; color: #fff; }
.search-pagination { display: flex; min-height: 60px; flex-wrap: wrap; align-items: center; justify-content: center; gap: 0.25rem; color: #56627a; font-size: 0.875rem; }
.search-pagination__link { display: inline-flex; min-width: 44px; min-height: 44px; align-items: center; justify-content: center; border-radius: 0.5rem; padding: 0 0.625rem; color: #2450dc; font-weight: 700; text-decoration: none; }
.search-pagination__page--current { background: #2450dc; color: #fff; }
.search-pagination__ellipsis { display: inline-flex; min-width: 24px; min-height: 44px; align-items: center; justify-content: center; }
.search-ad { margin-top: 2rem; }
.search-aside { align-self: start; padding: 1.5rem; border-radius: 0.5rem; background: #f7f8fa; }
.search-aside h2 { margin: 0; font-size: 1rem; font-weight: 800; }
.search-aside p, .search-aside small { color: #56627a; font-size: 0.8125rem; line-height: 1.6; }
.search-aside a { display: flex; min-height: 44px; align-items: center; justify-content: space-between; border-bottom: 1px solid #e6e9f0; color: #15213b; font-size: 0.875rem; font-weight: 700; text-decoration: none; }
.search-aside small { display: block; margin-top: 1rem; }
@keyframes search-shimmer { to { background-position: -200% 0; } }
@media (prefers-reduced-motion: reduce) { .result-skeleton span { animation: none; } }
@media (max-width: 900px) { .search-layout { grid-template-columns: minmax(0, 1fr); } .search-aside { margin-top: 1rem; } }
@media (max-width: 640px) {
  .search-page__inner { width: min(100% - 1.5rem, 1200px); padding-top: 1.5rem; }
  .search-hero h1 { margin-bottom: 1.25rem; font-size: 1.6875rem; }
  .search-layout { margin-top: 1.5rem; }
  .domain-section + .domain-section { margin-top: 2rem; }
  .domain-section__note { width: 100%; margin: -0.375rem 0 0.75rem; }
}
</style>
