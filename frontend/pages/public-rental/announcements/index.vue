<template>
  <div class="bg-background-light">
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">공공임대 모집공고</h1>
        <p class="mt-2 text-slate-500 text-sm">
          LH·SH·GH 등 공공기관이 발표한 입주자 모집공고를 모아 확인하세요.
          진행중인 공고와 예정 공고, 최근 마감 공고를 시기별로 분류해 보여드립니다.
        </p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-5 md:px-6 md:py-6 space-y-5">
      <PublicRentalFilterTabs active="announcements" />

      <!-- 상태 필터 -->
      <div class="flex flex-wrap gap-2">
        <button
          v-for="opt in STATUS_FILTERS"
          :key="opt.value ?? 'all'"
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
          :class="status === opt.value
            ? 'bg-primary text-white border-primary'
            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'"
          @click="setStatus(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>

      <!-- 검색 -->
      <div class="flex items-center gap-2">
        <input
          v-model="q"
          type="search"
          placeholder="공고명·단지명·기관명 검색"
          class="flex-1 px-3 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-slate-400"
          @keydown.enter="reload"
        />
        <button
          type="button"
          class="px-4 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary-dark transition-colors"
          @click="reload"
        >
          검색
        </button>
      </div>

      <!-- 목록 -->
      <div v-if="loading" class="py-12 text-center text-slate-400 text-sm">불러오는 중…</div>
      <div v-else-if="error" class="py-12 text-center text-rose-500 text-sm">{{ error }}</div>
      <div v-else-if="items.length === 0" class="py-12 text-center text-slate-400 text-sm">
        해당 조건의 모집공고가 없습니다.
      </div>
      <ul v-else class="grid gap-3 md:grid-cols-2">
        <li
          v-for="ann in items"
          :key="ann.pblancId"
          class="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
        >
          <NuxtLink :to="`/public-rental/announcements/${encodeURIComponent(ann.pblancId)}`" class="block">
            <div class="flex items-start justify-between gap-3 mb-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium shrink-0"
                :class="STATUS_BADGE[ann.status]"
              >
                {{ STATUS_LABEL[ann.status] }}
              </span>
              <span v-if="ann.suplyTyNm" class="text-xs text-slate-500 shrink-0">{{ ann.suplyTyNm }}</span>
            </div>
            <h2 class="text-base font-semibold text-slate-900 leading-snug line-clamp-2">
              {{ ann.pblancNm }}
            </h2>
            <p class="mt-1 text-xs text-slate-500">
              <span v-if="ann.suplyInsttNm">{{ ann.suplyInsttNm }}</span>
              <span v-if="ann.brtcNm || ann.signguNm" class="ml-1">
                · {{ [ann.brtcNm, ann.signguNm].filter(Boolean).join(' ') }}
              </span>
            </p>
            <p class="mt-2 text-xs text-slate-600">
              <span v-if="ann.beginDe || ann.endDe">
                접수 {{ formatDateRange(ann.beginDe, ann.endDe) }}
              </span>
              <span v-else class="text-slate-400">접수 일정 미정</span>
              <span v-if="ann.totalSupply" class="ml-2 text-slate-500">· {{ ann.totalSupply }}세대</span>
              <span v-if="ann.variantCount > 1" class="ml-1 text-slate-400">({{ ann.variantCount }}개 단지)</span>
            </p>
          </NuxtLink>
        </li>
      </ul>

      <!-- 페이지네이션 -->
      <Pagination
        v-if="totalPages > 1"
        :current-page="page"
        :total-pages="totalPages"
        @page-change="setPage"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRentalAnnouncements } from '~/composables/useRentalAnnouncements'
import type { AnnouncementStatus } from '~/types/publicRentalAnnouncement'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import PublicRentalFilterTabs from '~/components/publicRental/PublicRentalFilterTabs.vue'

const STATUS_FILTERS: Array<{ value: AnnouncementStatus | undefined; label: string }> = [
  { value: undefined, label: '전체' },
  { value: 'ongoing', label: '진행중' },
  { value: 'upcoming', label: '예정' },
  { value: 'closed', label: '마감' },
]

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  ongoing: '진행중',
  upcoming: '예정',
  closed: '마감',
  unknown: '일정 미정',
}

const STATUS_BADGE: Record<AnnouncementStatus, string> = {
  ongoing: 'bg-emerald-50 text-emerald-700',
  upcoming: 'bg-blue-50 text-blue-700',
  closed: 'bg-slate-100 text-slate-500',
  unknown: 'bg-slate-50 text-slate-500',
}

const status = ref<AnnouncementStatus | undefined>('ongoing')
const q = ref('')
const page = ref(1)

const { items, total, totalPages, loading, error, fetchList } = useRentalAnnouncements()

async function load() {
  await fetchList({
    page: page.value,
    limit: 20,
    status: status.value,
    q: q.value || undefined,
  })
}

function reload() {
  page.value = 1
  load()
}

function setStatus(value: AnnouncementStatus | undefined) {
  status.value = value
  reload()
}

function setPage(next: number) {
  if (next < 1 || next > totalPages.value) return
  page.value = next
  load()
}

function formatDateRange(begin: string | null, end: string | null): string {
  if (begin && end) return `${begin} ~ ${end}`
  if (begin) return `${begin} ~`
  if (end) return `~ ${end}`
  return ''
}

watch(items, () => {
  /* surface total to template via reactivity */
  void total.value
})

await load()

const title = '공공임대 모집공고 | 일상킷'
const description = 'LH·SH·GH 등 공공기관 입주자 모집공고를 한눈에. 진행중·예정·마감 공고를 시기별로 확인하고 단지별 모집 정보를 비교하세요.'
const canonicalUrl = `${SITE_URL}/public-rental/announcements`

useHead({
  title,
  meta: [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})
</script>
