<template>
  <section class="subscription-list" aria-labelledby="subscription-list-title">
    <SubscriptionNav :filters="filters" />

    <div class="filter-box" aria-label="공고 검색 필터">
      <nav class="type-tabs" aria-label="공급유형">
        <SegmentedControl :items="typeSegmentItems" :model-value="activeTypePath" aria-label="공급유형 선택" />
      </nav>

      <form class="filter-controls" @submit.prevent="submitKeyword">
        <div class="region-filter-field">
          <RegionCascadingDropdown
            :city="filters.city"
            :district="filters.district"
            variant="flat"
            @update:city="(city: string) => applyFilters({ city, district: '' })"
            @update:district="(district: string) => applyFilters({ district })"
          />
        </div>
        <div>
          <label for="subscription-keyword">공고명 또는 지역 검색</label>
          <input
            id="subscription-keyword"
            v-model="draftKeyword"
            type="search"
            autocomplete="off"
            maxlength="120"
            placeholder="공고명이나 지역명"
          >
        </div>
        <button class="search-button" type="submit">검색</button>
        <button
          type="button"
          class="reset"
          data-testid="reset-filters"
          @click="resetFilters"
        >
          조건 초기화
        </button>
      </form>

      <p v-if="keywordError" class="filter-error" role="alert">
        {{ keywordError }}
      </p>
    </div>

    <div class="status-tabs">
      <SegmentedControl
        :items="statusSegmentItems"
        :model-value="filters.status"
        aria-label="접수 상태"
        @update:model-value="(value) => applyFilters({ status: value as SubscriptionListFilters['status'] })"
      />
    </div>

    <div v-if="showAds" class="ad-slot">
      <AdBanner />
    </div>

    <section aria-label="검색 결과">
      <div id="subscription-results" class="results-tools">
        <p id="subscription-list-title">
          <template v-if="pending">공고를 불러오는 중입니다</template>
          <template v-else-if="showResultCount"><strong>{{ displayedCount }}</strong>건 표시 / 총 <strong>{{ totalCount }}</strong>건</template>
          <template v-else>{{ resultStatusText }}</template>
        </p>
        <label>
          <span class="sr-only">공고 정렬</span>
          <select
            class="sort-select"
            :value="filters.sort"
            aria-label="공고 정렬"
            @change="applyFilters({ sort: ($event.target as HTMLSelectElement).value as SubscriptionListFilters['sort'] })"
          >
            <option value="priority">추천순</option>
            <option value="deadline">마감 가까운 순</option>
            <option value="recent">최근 공고순</option>
          </select>
        </label>
      </div>

      <div class="list-shell" :aria-busy="pending ? 'true' : 'false'">
        <div class="row-head" aria-hidden="true">
          <span>공고명 / 공급유형</span>
          <span>지역</span>
          <span>공급규모</span>
          <span>접수기간</span>
        </div>

        <template v-if="pending">
          <div
            v-for="index in 5"
            :key="index"
            class="notice-row-skeleton"
            data-testid="list-skeleton"
          >
            <span class="skeleton-line skeleton-line--title" />
            <span class="skeleton-line" />
            <span class="skeleton-line" />
            <span class="skeleton-line" />
          </div>
        </template>

        <div v-else-if="regionError" class="state-box state-box--error" role="alert">
          <p>{{ regionError }}</p>
          <button type="button" data-testid="region-retry" @click="retry">지역 다시 불러오기</button>
        </div>

        <div v-else-if="error" class="state-box state-box--error" role="alert">
          <p>{{ error }}</p>
          <button type="button" @click="retry">다시 시도</button>
        </div>

        <div v-else-if="items.length === 0" class="empty">
          <h3>조건에 맞는 공고가 없어요</h3>
          <p>지역이나 접수 상태를 바꿔 다시 살펴보세요.</p>
          <button type="button" @click="resetFilters">모든 공고 보기</button>
        </div>

        <template v-else>
          <SubscriptionNoticeRow
            v-for="item in items"
            :key="item.id"
            :ref="(el) => setRowRef(item.id, el)"
            :item="item"
            :selected-city="filters.city"
            :selected-district="filters.district"
            @open-detail="saveForDetail"
          />

          <p v-if="props.scope.category === 'rent'" class="schedule-note">
            <strong>일정 확인이 필요한 공고도 있어요</strong>
            지역·공급별 접수기간이 다를 수 있습니다. 상세에서 해당 일정을 확인하세요.
          </p>
        </template>
      </div>

      <p class="load-status" role="status" aria-live="polite">{{ loadStatus }}</p>

      <button
        v-if="canLoadMore && !moreError"
        type="button"
        class="load-more"
        data-testid="load-more"
        :disabled="pendingMore"
        @click="handleLoadMore"
      >
        {{ pendingMore ? '불러오는 중' : '공고 더 보기' }}
      </button>

      <div v-if="moreError" class="more-error">
        <p>{{ moreError }}</p>
        <button type="button" data-testid="load-more-retry" @click="handleLoadMore">다시 시도</button>
      </div>
    </section>

    <div v-if="showAds" class="ad-slot">
      <AdBanner />
    </div>

    <DataSourceSection domain="subscription" variant="flat" class="source-note" />

    <section class="faq" aria-labelledby="subscription-list-faq-title">
      <h2 id="subscription-list-faq-title">공고를 보기 전에</h2>
      <div>
        <details v-for="faq in faqs" :key="faq.question">
          <summary>{{ faq.question }}</summary>
          <p>{{ faq.answer }}</p>
        </details>
      </div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch, watchEffect } from 'vue'
import type { ComponentPublicInstance } from 'vue'
import type { SubscriptionListFilters, SubscriptionListScope } from '~/types/subscriptionList'
import type { CityData } from '~/composables/useRegions'
import { suppressAds } from '~/composables/useAdsPolicy'
import { useSubscriptionList } from '~/composables/useSubscriptionList'
import { useRegions } from '~/composables/useRegions'
import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import SegmentedControl from '~/components/common/SegmentedControl.vue'
import SubscriptionNav from '~/components/subscription/SubscriptionNav.vue'
import SubscriptionNoticeRow from '~/components/subscription/SubscriptionNoticeRow.vue'
import { normalizeSubscriptionQuery, subscriptionScopeForPath } from '~/utils/subscriptionListQuery'
import { RENT_TYPES, SALE_TYPES } from '~/utils/subscriptionMeta'

const props = defineProps<{
  scope: SubscriptionListScope
}>()

const regions = useRegions()

const {
  filters,
  items,
  total,
  page,
  totalPages,
  pending,
  pendingMore,
  error,
  moreError,
  keywordError,
  regionError,
  applyFilters,
  resetFilters,
  loadMore,
  retry,
  saveForDetail,
} = await useSubscriptionList(computed(() => props.scope))

const statuses = computed<Array<{ value: SubscriptionListFilters['status']; label: string }>>(() => {
  const base: Array<{ value: SubscriptionListFilters['status']; label: string }> = [
    { value: 'all', label: '전체' },
    { value: 'ongoing', label: '접수 중' },
    { value: 'upcoming', label: '접수 예정' },
  ]
  if (props.scope.category === 'rent' && props.scope.sourceType !== 'PRIVATE_RENT' && props.scope.type !== 'private') {
    base.push({ value: 'unknown', label: '일정 확인 필요' })
  }
  base.push({ value: 'closed', label: '마감' })
  return base
})

const faqs = [
  { question: '일상킷에서 바로 신청할 수 있나요?', answer: '공고 상세에서 일정과 공급정보를 확인한 뒤, 모집공고에 안내된 공식 신청처를 이용해 주세요.' },
  { question: '공공임대는 모두 청약통장이 필요한가요?', answer: '공급유형과 공고에 따라 신청 조건이 다릅니다. 청약통장, 소득·자산, 거주지역 등 자격은 해당 모집공고에서 확인해 주세요.' },
  { question: '일정 확인 필요는 어떤 상태인가요?', answer: '공개 자료에서 접수기간을 확인하기 어렵거나 공급지역별 일정이 다른 공고입니다. 마감된 공고라는 뜻은 아니며, 상세와 원문에서 일정을 확인할 수 있습니다.' },
]

const draftKeyword = ref(filters.value.q)
const rowRefs = new Map<number, Element>()
const loadStatus = ref('')

const failed = computed(() => Boolean(error.value || keywordError.value || regionError.value))
const filtered = computed(() =>
  Boolean(filters.value.q || filters.value.city || filters.value.district || filters.value.status !== 'all' || filters.value.sort !== 'priority')
)
const showAds = computed(() => !filtered.value && !failed.value)
const canLoadMore = computed(() => !pending.value && !regionError.value && !error.value && page.value < totalPages.value)
const showResultCount = computed(() => !pending.value && !failed.value)
const displayedCount = computed(() => items.value.length.toLocaleString('ko-KR'))
const totalCount = computed(() => total.value.toLocaleString('ko-KR'))
const resultStatusText = computed(() => {
  if (keywordError.value) return '검색 조건을 확인해 주세요'
  if (regionError.value) return '지역 정보를 확인할 수 없습니다'
  if (error.value) return '조회 결과를 불러오지 못했습니다'
  return '조회 결과'
})

function fallbackCitiesForFilters(): CityData[] {
  if (!filters.value.city) return []
  return [{
    slug: filters.value.city,
    name: filters.value.city,
    districts: filters.value.district
      ? [{ slug: filters.value.district, name: filters.value.district, lat: 0, lng: 0, bjdCode: '' }]
      : [],
  }]
}

function queryForScope(targetScope: SubscriptionListScope): Record<string, string> {
  const cities = regions.citiesWithDistricts.value.length > 0
    ? regions.citiesWithDistricts.value
    : fallbackCitiesForFilters()
  return normalizeSubscriptionQuery(filters.value, targetScope, cities).query
}

const typeLinks = computed(() => {
  const basePath = `/subscription/${props.scope.category}`
  const entries = props.scope.category === 'sale'
    ? Object.entries(SALE_TYPES)
    : Object.entries(RENT_TYPES)
  const allScope = subscriptionScopeForPath(basePath)!
  return [
    { label: '전체', path: basePath, scope: allScope, active: !props.scope.type },
    ...entries.map(([slug, meta]) => {
      const path = `${basePath}/${slug}`
      return { label: meta.label, path, scope: subscriptionScopeForPath(path)!, active: props.scope.type === slug }
    }),
  ].map(link => ({ ...link, query: queryForScope(link.scope) }))
})

const typeSegmentItems = computed(() => typeLinks.value.map((link) => {
  const qs = new URLSearchParams(link.query).toString()
  return { value: link.path, label: link.label, to: qs ? `${link.path}?${qs}` : link.path }
}))
const activeTypePath = computed(() => typeLinks.value.find((link) => link.active)?.path)
const statusSegmentItems = computed(() => statuses.value.map((status) => ({ value: status.value, label: status.label })))

watch(() => filters.value.q, (value) => {
  if (import.meta.client && document.activeElement?.id === 'subscription-keyword' && draftKeyword.value !== value) {
    return
  }
  draftKeyword.value = value
})

watchEffect(() => {
  suppressAds(filtered.value || failed.value)
})

function submitKeyword(): void {
  void applyFilters({ q: draftKeyword.value })
}

function setRowRef(id: number, el: Element | ComponentPublicInstance | null): void {
  if (!el) {
    rowRefs.delete(id)
    return
  }
  const element = '$el' in el ? el.$el as Element : el
  rowRefs.set(id, element)
}

async function handleLoadMore(): Promise<void> {
  const beforeIds = new Set(items.value.map(item => item.id))
  const beforeCount = items.value.length
  await loadMore()
  await nextTick()
  if (items.value.length <= beforeCount) return

  const firstNew = items.value.find(item => !beforeIds.has(item.id))
  const added = items.value.length - beforeCount
  loadStatus.value = `총 ${total.value.toLocaleString('ko-KR')}건 중 ${items.value.length.toLocaleString('ko-KR')}건 표시, ${added.toLocaleString('ko-KR')}건을 더 불러왔습니다.`
  if (!firstNew) return
  const target = rowRefs.get(firstNew.id)?.querySelector<HTMLElement>('.notice-name')
  target?.focus()
}
</script>

<style scoped>
.subscription-list {
  color: rgb(var(--ink-rgb));
}

.filter-box {
  margin-bottom: 28px;
  border-radius: 8px;
  background: rgb(var(--paper-rgb));
  padding: 22px 24px;
}


.type-tabs {
  margin-bottom: 18px;
  border-bottom: 1px solid rgb(var(--border-rgb));
  padding-bottom: 17px;
  /* 세그먼트는 한 줄이라 좁은 화면에서 넘치면 이 안에서 가로 스크롤.
     스크롤 영역은 바깥으로 그린 포커스 링(3px)을 자르므로 3px 여유를 두고 음수 margin 으로 정렬선을 맞춘다. */
  overflow-x: auto;
  padding-top: 3px;
  padding-inline: 3px;
  margin-inline: -3px;
}

.status-tabs {
  margin-bottom: 18px;
  overflow-x: auto;
  padding: 3px;
  margin-inline: -3px;
}

.filter-controls {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(260px, 1fr) auto auto;
  gap: 16px;
  align-items: end;
}

.filter-controls label {
  display: block;
  color: rgb(var(--muted-rgb));
  font-size: 12px;
  font-weight: 550;
}

.filter-controls input {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 6px;
  border: 1px solid rgb(var(--line-strong-rgb));
  border-radius: 5px;
  background: rgb(var(--surface-rgb));
  color: rgb(var(--ink-rgb));
  font-size: 14px;
  padding: 0 12px;
}

.search-button {
  min-height: 44px;
  border-radius: 5px;
  background: rgb(var(--brand-rgb));
  color: rgb(var(--surface-rgb));
  font-size: 14px;
  font-weight: 650;
  padding: 0 18px;
}

.reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 96px;
  min-height: 44px;
  color: rgb(var(--muted-rgb));
  font-size: 13px;
  text-decoration: underline;
  text-underline-offset: 4px;
  white-space: nowrap;
}

.filter-error {
  margin-top: 12px;
  color: #b42318;
  font-size: 13px;
  overflow-wrap: anywhere;
}

.ad-slot {
  margin: 32px 0;
}

.results-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin: 20px 0 14px;
  scroll-margin-top: 90px;
}

.results-tools p {
  font-size: 14px;
}

.results-tools strong {
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.sort-select {
  min-height: 44px;
  border: 0;
  background: rgb(var(--surface-rgb));
  color: rgb(var(--muted-rgb));
  font-size: 13px;
  padding: 6px 25px 6px 8px;
}

.row-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 80px 178px;
  gap: 24px;
  border-top: 1px solid rgb(var(--border-rgb));
  border-bottom: 1px solid rgb(var(--border-rgb));
  background: rgb(var(--paper-rgb));
  color: rgb(var(--muted-rgb));
  font-size: 12px;
  padding: 11px 18px;
}

.row-head > :nth-child(3),
.row-head > :last-child {
  text-align: right;
}


.notice-row-skeleton {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 80px 178px;
  gap: 24px;
  align-items: center;
  border-bottom: 1px solid rgb(var(--border-rgb));
  padding: 22px 18px;
}

.skeleton-line {
  display: block;
  height: 14px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgb(var(--track-rgb)) 0%, rgb(var(--paper-rgb)) 45%, rgb(var(--track-rgb)) 100%);
}

.skeleton-line--title {
  height: 18px;
  max-width: 72%;
}

.state-box,
.empty {
  border-block: 1px solid rgb(var(--border-rgb));
  padding: 65px 20px;
  text-align: center;
}

.state-box {
  color: rgb(var(--muted-rgb));
}

.state-box p,
.more-error p {
  max-width: 100%;
  overflow-wrap: anywhere;
  word-break: keep-all;
}

.state-box button,
.empty button,
.more-error button {
  min-height: 44px;
  color: rgb(var(--brand-rgb));
  font-weight: 600;
}

.state-box--error {
  color: #b42318;
}

.empty h3 {
  font-size: 19px;
}

.empty p {
  margin: 9px 0 18px;
  color: rgb(var(--muted-rgb));
  font-size: 14px;
}

.schedule-note {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin-top: 20px;
  border-bottom: 1px solid rgb(var(--border-rgb));
  color: rgb(var(--muted-rgb));
  font-size: 13px;
  padding: 15px 0;
}

.schedule-note strong {
  color: rgb(var(--ink-rgb));
  font-size: 13px;
  white-space: nowrap;
}

.load-status {
  min-height: 1px;
  color: rgb(var(--muted-rgb));
  font-size: 13px;
}

.load-more {
  display: block;
  min-width: 200px;
  margin: 26px auto 8px;
  border: 1px solid rgb(var(--border-2-rgb));
  border-radius: 6px;
  color: rgb(var(--muted-rgb));
  font-size: 14px;
  padding: 11px 24px;
}

.load-more:disabled {
  opacity: 0.6;
}

.more-error {
  margin: 20px 0;
  text-align: center;
  color: #b42318;
  font-size: 13px;
}

.source-note {
  margin: 26px 0 45px;
}


.faq {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 36px;
  margin: 36px 0 52px;
  border-top: 1px solid rgb(var(--border-rgb));
  padding-top: 26px;
}

.faq h2 {
  color: rgb(var(--ink-rgb));
  font-size: 20px;
  font-weight: 700;
}

.faq details {
  border-bottom: 1px solid rgb(var(--border-rgb));
  padding: 13px 0;
}

.faq summary {
  cursor: pointer;
  font-weight: 550;
}

.faq p {
  color: rgb(var(--muted-rgb));
  font-size: 14px;
  line-height: 1.8;
  padding: 10px 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (max-width: 1000px) {
  .row-head,
  .notice-row-skeleton {
    grid-template-columns: minmax(0, 1fr) 90px 70px 156px;
    gap: 14px;
  }
}

@media (min-width: 701px) and (max-width: 900px) {
  .filter-controls {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .region-filter-field {
    grid-column: 1 / -1;
  }
}

@media (max-width: 700px) {
  .filter-box {
    margin-bottom: 22px;
    padding: 15px;
  }

  .type-tabs {
    margin-bottom: 13px;
    padding-bottom: 12px;
  }

  .filter-controls {
    grid-template-columns: minmax(0, 1fr) minmax(88px, auto);
    gap: 10px 8px;
  }

  .region-filter-field {
    grid-column: 1 / -1;
  }

  .filter-controls input {
    min-height: 44px;
    padding: 0 9px;
    font-size: 13px;
  }

  .search-button {
    min-width: 88px;
    padding: 0 12px;
  }

  .reset {
    grid-column: 1 / -1;
    justify-self: end;
    min-width: 96px;
    min-height: 44px;
    padding: 0 4px;
    font-size: 12px;
  }

  .results-tools {
    align-items: baseline;
    margin: 15px 0 8px;
  }

  .results-tools p {
    font-size: 13px;
  }

  .row-head {
    display: none;
  }

  .notice-row-skeleton {
    grid-template-columns: minmax(0, 1fr);
    gap: 10px;
    padding: 20px 0;
  }

  .notice-row-skeleton .skeleton-line:not(.skeleton-line--title) {
    max-width: 45%;
  }

  .schedule-note {
    display: block;
    font-size: 12px;
  }

  .schedule-note strong {
    display: block;
    margin-bottom: 4px;
  }

  .load-more {
    width: 100%;
    min-height: 44px;
  }

  .faq {
    display: block;
    margin: 30px 0 40px;
  }

  .faq h2 {
    margin-bottom: 13px;
  }

  .faq summary {
    font-size: 14px;
  }
}
</style>
