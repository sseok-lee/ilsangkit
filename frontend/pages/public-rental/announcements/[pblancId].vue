<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-4xl px-4 py-6 md:px-6 md:py-8 space-y-6">
      <button
        type="button"
        class="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        @click="goBack"
      >
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        뒤로가기
      </button>

      <div v-if="loading" class="py-16 text-center text-slate-400 text-sm">불러오는 중…</div>
      <div v-else-if="error" class="py-16 text-center text-rose-500 text-sm">{{ error }}</div>
      <template v-else-if="detail">
        <header class="bg-white border border-slate-200 rounded-xl p-5 md:p-6 space-y-3">
          <div class="flex items-center gap-2">
            <span
              class="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
              :class="STATUS_BADGE[detail.status]"
            >
              {{ STATUS_LABEL[detail.status] }}
            </span>
            <span v-if="detail.suplyTyNm" class="text-xs text-slate-500">{{ detail.suplyTyNm }}</span>
          </div>
          <h1 class="text-xl md:text-2xl font-bold text-slate-900 leading-snug">{{ detail.pblancNm }}</h1>
          <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div v-if="detail.suplyInsttNm" class="flex gap-2">
              <dt class="text-slate-500 w-20 shrink-0">공급기관</dt>
              <dd class="text-slate-800">{{ detail.suplyInsttNm }}</dd>
            </div>
            <div v-if="detail.brtcNm || detail.signguNm" class="flex gap-2">
              <dt class="text-slate-500 w-20 shrink-0">지역</dt>
              <dd class="text-slate-800">{{ [detail.brtcNm, detail.signguNm].filter(Boolean).join(' ') }}</dd>
            </div>
            <div v-if="detail.beginDe || detail.endDe" class="flex gap-2">
              <dt class="text-slate-500 w-20 shrink-0">접수기간</dt>
              <dd class="text-slate-800">{{ formatDateRange(detail.beginDe, detail.endDe) }}</dd>
            </div>
            <div v-if="detail.rcritPblancDe" class="flex gap-2">
              <dt class="text-slate-500 w-20 shrink-0">공고일</dt>
              <dd class="text-slate-800">{{ detail.rcritPblancDe }}</dd>
            </div>
            <div v-if="detail.przwnerDe" class="flex gap-2">
              <dt class="text-slate-500 w-20 shrink-0">발표일</dt>
              <dd class="text-slate-800">{{ detail.przwnerDe }}</dd>
            </div>
            <div v-if="totalSupply" class="flex gap-2">
              <dt class="text-slate-500 w-20 shrink-0">공급 호수</dt>
              <dd class="text-slate-800">{{ totalSupply }}호</dd>
            </div>
            <div v-if="detail.hsmpNm" class="flex gap-2">
              <dt class="text-slate-500 w-20 shrink-0">대표 단지</dt>
              <dd class="text-slate-800">{{ detail.hsmpNm }}</dd>
            </div>
            <div v-if="detail.refrnc" class="flex gap-2 sm:col-span-2">
              <dt class="text-slate-500 w-20 shrink-0">문의처</dt>
              <dd class="text-slate-800">{{ detail.refrnc }}</dd>
            </div>
          </dl>
          <div class="flex flex-wrap gap-2 mt-2">
            <a
              v-if="detail.pcUrl"
              :href="detail.pcUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800"
            >
              마이홈 공고 원문 <span class="text-xs">↗</span>
            </a>
            <a
              v-if="detail.url"
              :href="detail.url"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50"
            >
              {{ detail.suplyInsttNm ?? '신청' }} 신청 페이지 <span class="text-xs">↗</span>
            </a>
          </div>
        </header>

        <section v-if="detail.variants && detail.variants.length > 0" class="space-y-3">
          <h2 class="text-base font-semibold text-slate-900">
            공고 내 단지 {{ detail.variants.length > 1 ? `(${detail.variants.length})` : '' }}
          </h2>
          <ul class="grid gap-3 md:grid-cols-2">
            <li
              v-for="v in detail.variants"
              :key="v.houseSn"
              class="bg-white border border-slate-200 rounded-xl p-4"
            >
              <div class="flex items-center justify-between gap-2 mb-1">
                <h3 class="text-sm font-semibold text-slate-900">
                  {{ v.hsmpNm ?? `호수 ${v.houseSn}` }}
                </h3>
                <span v-if="v.suplyTyNm" class="text-xs text-slate-500">{{ v.suplyTyNm }}</span>
              </div>
              <p v-if="v.fullAdres" class="text-xs text-slate-500 mb-2">{{ v.fullAdres }}</p>
              <dl class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div v-if="v.sumSuplyCo" class="flex gap-1">
                  <dt class="text-slate-500">공급</dt>
                  <dd class="text-slate-800">{{ v.sumSuplyCo }}호</dd>
                </div>
                <div v-if="v.totHshldCo" class="flex gap-1">
                  <dt class="text-slate-500">단지</dt>
                  <dd class="text-slate-800">{{ v.totHshldCo }}세대</dd>
                </div>
                <div v-if="v.rentGtn" class="flex gap-1">
                  <dt class="text-slate-500">보증금</dt>
                  <dd class="text-slate-800">{{ formatKrw(v.rentGtn) }}</dd>
                </div>
                <div v-if="v.mtRntchrg" class="flex gap-1">
                  <dt class="text-slate-500">월임대료</dt>
                  <dd class="text-slate-800">{{ formatKrw(v.mtRntchrg) }}</dd>
                </div>
              </dl>
            </li>
          </ul>
        </section>

        <section v-if="detail.matchedComplexes && detail.matchedComplexes.length > 0" class="space-y-3">
          <h2 class="text-base font-semibold text-slate-900">관련 공공임대 단지 <span class="text-xs text-slate-500 font-normal">({{ detail.matchedComplexes.length }})</span></h2>
          <ul class="grid gap-3 md:grid-cols-2">
            <li
              v-for="c in detail.matchedComplexes"
              :key="c.id"
              class="bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
            >
              <NuxtLink :to="`/public-rental/${c.id}`" class="block">
                <h3 class="text-sm font-semibold text-slate-900">
                  {{ c.complexNameKor || c.complexName }}
                </h3>
                <p class="mt-1 text-xs text-slate-500">
                  {{ [c.city, c.district].filter(Boolean).join(' ') }}
                  <span v-if="c.rentalType" class="ml-1">· {{ c.rentalType }}</span>
                </p>
                <p v-if="c.exclusiveArea" class="mt-1 text-xs text-slate-600">
                  전용 {{ c.exclusiveArea }}㎡
                  <span v-if="c.householdCount" class="ml-1 text-slate-500">· {{ c.householdCount }}세대</span>
                </p>
              </NuxtLink>
            </li>
          </ul>
        </section>
        <p v-else class="text-xs text-slate-500">
          공고에 매칭된 단지 카탈로그 정보가 없습니다. 모집공고 원문을 직접 확인해주세요.
        </p>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useRentalAnnouncements } from '~/composables/useRentalAnnouncements'
import type { AnnouncementStatus } from '~/types/publicRentalAnnouncement'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'

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

const route = useRoute()
const router = useRouter()
const pblancId = String(route.params.pblancId)

function goBack() {
  if (import.meta.client && window.history.length > 1) {
    router.back()
  } else {
    navigateTo('/public-rental/announcements')
  }
}

const { detail, loading, error, fetchDetail } = useRentalAnnouncements()
await fetchDetail(pblancId)

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

const title = detail.value
  ? `${detail.value.pblancNm} | 공공임대 모집공고 | 일상킷`
  : '공공임대 모집공고 | 일상킷'
const description = detail.value
  ? `${detail.value.suplyInsttNm ?? '공공기관'}의 ${detail.value.suplyTyNm ?? '공공임대'} 모집공고. 접수기간·공급세대수·관련 단지 정보를 확인하세요.`
  : '공공임대 모집공고 상세 정보입니다.'
const canonicalUrl = `${SITE_URL}/public-rental/announcements/${encodeURIComponent(pblancId)}`

useHead({
  title,
  meta: [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'article' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})
</script>
