<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8 space-y-6">
      <div v-if="loading" class="py-16 text-center text-faint text-sm">{{ UI_MESSAGES.loading }}</div>
      <div v-else-if="error" class="py-16 text-center text-rose-500 text-sm">{{ error }}</div>
      <template v-else-if="detail">
        <header class="bg-white border border-line-2 rounded-xl p-5 md:p-6 space-y-3">
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
              :class="STATUS_BADGE[detail.status]"
            >
              {{ STATUS_LABEL[detail.status] }}
            </span>
            <span v-if="detail.suplyTyNm" class="text-xs text-muted">{{ detail.suplyTyNm }}</span>
          </div>
          <h1 class="text-xl md:text-2xl font-bold text-strong leading-snug">{{ detail.pblancNm }}</h1>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div v-if="detail.suplyInsttNm" class="flex gap-2">
              <dt class="text-muted w-20 shrink-0">공급기관</dt>
              <dd class="text-ink">{{ detail.suplyInsttNm }}</dd>
            </div>
            <div v-if="detail.brtcNm || detail.signguNm" class="flex gap-2">
              <dt class="text-muted w-20 shrink-0">지역</dt>
              <dd class="text-ink">{{ [detail.brtcNm, detail.signguNm].filter(Boolean).join(' ') }}</dd>
            </div>
            <div v-if="detail.beginDe || detail.endDe" class="flex gap-2">
              <dt class="text-muted w-20 shrink-0">접수기간</dt>
              <dd class="text-ink font-display tabular-nums">{{ formatDateRange(detail.beginDe, detail.endDe) }}</dd>
            </div>
            <div v-if="detail.rcritPblancDe" class="flex gap-2">
              <dt class="text-muted w-20 shrink-0">공고일</dt>
              <dd class="text-ink font-display tabular-nums">{{ detail.rcritPblancDe }}</dd>
            </div>
            <div v-if="detail.przwnerDe" class="flex gap-2">
              <dt class="text-muted w-20 shrink-0">발표일</dt>
              <dd class="text-ink font-display tabular-nums">{{ detail.przwnerDe }}</dd>
            </div>
            <div v-if="totalSupply" class="flex gap-2">
              <dt class="text-muted w-20 shrink-0">공급 호수</dt>
              <dd class="text-strong font-display tabular-nums">{{ totalSupply }}호</dd>
            </div>
            <div v-if="detail.hsmpNm" class="flex gap-2">
              <dt class="text-muted w-20 shrink-0">대표 단지</dt>
              <dd class="text-ink">{{ detail.hsmpNm }}</dd>
            </div>
            <div v-if="detail.refrnc" class="flex gap-2 sm:col-span-2">
              <dt class="text-muted w-20 shrink-0">문의처</dt>
              <dd class="text-ink">{{ detail.refrnc }}</dd>
            </div>
          </dl>
          <div class="flex flex-wrap gap-2 mt-2">
            <a
              v-if="detail.pcUrl"
              :href="detail.pcUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
            >
              마이홈 공고 원문 <span class="text-xs">↗</span>
            </a>
            <a
              v-if="detail.url"
              :href="detail.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 px-4 py-2 bg-white border border-line-2 text-ink text-sm font-medium rounded-lg hover:bg-background-light"
            >
              {{ detail.suplyInsttNm ?? '신청' }} 신청 페이지 <span class="text-xs">↗</span>
            </a>
          </div>
        </header>

        <!-- Ad: 헤더 카드 직후 (청약 패턴 1번) -->
        <AdBanner />

        <section v-if="detail.variants && detail.variants.length > 0" class="space-y-3">
          <h2 class="text-base font-semibold text-strong">
            공고 내 단지 {{ detail.variants.length > 1 ? `(${detail.variants.length})` : '' }}
          </h2>
          <ul class="grid gap-3 md:grid-cols-2">
            <li
              v-for="v in detail.variants"
              :key="v.houseSn"
              class="bg-white border border-line-2 rounded-xl p-4"
            >
              <div class="flex items-center justify-between gap-2 mb-1">
                <h3 class="text-sm font-semibold text-strong">
                  {{ v.hsmpNm ?? `호수 ${v.houseSn}` }}
                </h3>
                <span v-if="v.suplyTyNm" class="text-xs text-muted">{{ v.suplyTyNm }}</span>
              </div>
              <p v-if="v.fullAdres" class="text-xs text-muted mb-2">{{ v.fullAdres }}</p>
              <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div v-if="v.sumSuplyCo" class="flex gap-1">
                  <dt class="text-faint">공급</dt>
                  <dd class="text-strong font-display tabular-nums">{{ v.sumSuplyCo }}호</dd>
                </div>
                <div v-if="v.totHshldCo" class="flex gap-1">
                  <dt class="text-faint">단지</dt>
                  <dd class="text-strong font-display tabular-nums">{{ v.totHshldCo }}세대</dd>
                </div>
                <div v-if="v.rentGtn" class="flex gap-1">
                  <dt class="text-faint">보증금</dt>
                  <dd class="text-strong font-display tabular-nums">{{ formatKrw(v.rentGtn) }}</dd>
                </div>
                <div v-if="v.mtRntchrg" class="flex gap-1">
                  <dt class="text-faint">월임대료</dt>
                  <dd class="text-strong font-display tabular-nums">{{ formatKrw(v.mtRntchrg) }}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </section>

        <!-- Ad: 공고 내 단지(variants) 이후 (청약 패턴 2번) -->
        <AdBanner />

        <section v-if="detail.matchedComplexes && detail.matchedComplexes.length > 0" class="space-y-3">
          <h2 class="text-base font-semibold text-strong">관련 공공임대 단지 <span class="text-xs text-muted font-normal">({{ detail.matchedComplexes.length }})</span></h2>
          <ul class="grid gap-3 md:grid-cols-2">
            <li
              v-for="c in detail.matchedComplexes"
              :key="c.id"
              class="bg-white border border-line-2 rounded-xl p-4 hover:border-line-2 transition-colors"
            >
              <NuxtLink :to="`/public-rental/${c.id}`" class="block">
                <h3 class="text-sm font-semibold text-strong">
                  {{ c.complexNameKor || c.complexName }}
                </h3>
                <p class="mt-1 text-xs text-muted">
                  {{ [c.city, c.district].filter(Boolean).join(' ') }}
                  <span v-if="c.rentalType" class="ml-1">· {{ c.rentalType }}</span>
                </p>
                <p v-if="c.exclusiveArea" class="mt-1 text-xs text-ink">
                  전용 {{ c.exclusiveArea }}㎡
                  <span v-if="c.householdCount" class="ml-1 text-muted">· {{ c.householdCount }}세대</span>
                </p>
              </NuxtLink>
            </li>
          </ul>
        </section>
        <p v-else class="text-xs text-muted">
          공고에 매칭된 단지 카탈로그 정보가 없습니다. 모집공고 원문을 직접 확인해주세요.
        </p>

        <!-- Ad: 본문 마무리 (청약 패턴 3번) -->
        <AdBanner />
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { useRentalAnnouncements } from '~/composables/useRentalAnnouncements'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import type { AnnouncementStatus } from '~/types/publicRentalAnnouncement'
import { SITE_URL } from '~/utils/seoConstants'

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  ongoing: '모집중',
  upcoming: '예정',
  closed: '마감',
  unknown: '일정 미정',
}

const STATUS_BADGE: Record<AnnouncementStatus, string> = {
  ongoing: 'bg-emerald-50 text-emerald-700',
  upcoming: 'bg-primary-50 text-primary-700',
  closed: 'bg-slate-100 text-slate-500',
  unknown: 'bg-slate-50 text-slate-500',
}

const route = useRoute()
const pblancId = String(route.params.pblancId)

const { detail, loading, error, fetchDetail } = useRentalAnnouncements()
await fetchDetail(pblancId)

// 없는/만료 공고 → 404 (에러 UI를 200 OK로 색인하던 것 차단)
if (!detail.value) {
  throw createError({ statusCode: 404, statusMessage: 'Announcement not found', fatal: true })
}
const ann = detail.value   // non-null after guard

const { setBreadcrumbSchema } = useStructuredData()

function formatDateRange(begin: string | null, end: string | null): string {
  if (begin && end) return `${begin} ~ ${end}`
  if (begin) return `${begin} ~`
  if (end) return `~ ${end}`
  return ''
}

function formatKrw(amount: number | null | undefined): string {
  if (!amount) return '-'
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000)
    const man = Math.floor((amount % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`
  }
  if (amount >= 10_000) {
    return `${Math.floor(amount / 10_000).toLocaleString()}만원`
  }
  return `${amount.toLocaleString()}원`
}

const totalSupply = computed(() => {
  if (!detail.value?.variants) return null
  let sum = 0
  let hasValue = false
  for (const v of detail.value.variants) {
    if (typeof v.sumSuplyCo === 'number') {
      sum += v.sumSuplyCo
      hasValue = true
    }
  }
  return hasValue ? sum : null
})

const canonicalUrl = `${SITE_URL}/public-rental/announcements/${encodeURIComponent(pblancId)}`

const isClosed = ann.status === 'closed'
const annDescription = `${ann.suplyInsttNm ?? '공공기관'}의 ${ann.suplyTyNm ?? '공공임대'} 모집공고. 접수기간·공급세대수·관련 단지 정보를 확인하세요.`

const { setMeta } = useFacilityMeta()

setMeta({
  title: ann.pblancNm,
  description: annDescription,
  path: `/public-rental/announcements/${encodeURIComponent(pblancId)}`,
  type: 'article',
  // noindex 페이지에서는 canonical 제거(신호 충돌 방지)
  canonical: isClosed ? false : undefined,
})

if (isClosed) {
  useHead({ meta: [{ name: 'robots', content: 'noindex, follow' }] })
}

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공공임대', url: '/public-rental' },
  { name: '모집공고', url: '/public-rental/announcements' },
  { name: ann.pblancNm, url: canonicalUrl },
])
</script>
