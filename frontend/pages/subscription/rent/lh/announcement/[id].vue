<template>
  <div class="bg-background-light">
    <div v-if="pending" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p class="text-slate-600">로딩 중...</p>
      </div>
    </div>

    <template v-else-if="announcement">
      <!-- 헤더 -->
      <section class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100" data-test-section="header">
        <div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-slate-500 mb-1">{{ announcement.cnpNm }}</p>
              <h1 class="text-2xl md:text-3xl font-bold text-slate-900 leading-snug">
                {{ announcement.panNm }}
              </h1>
            </div>
            <span :class="statusBadgeClass">{{ statusLabel }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span :class="typeBadgeClass">{{ announcement.uppAisTpNm }}</span>
            <span v-if="announcement.aisTpNm" class="bg-slate-100 text-slate-700 px-2 py-1 rounded font-medium">
              {{ announcement.aisTpNm }}
            </span>
          </div>
          <div class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-600">
            <p v-if="announcement.panDt"><span class="font-medium">공고일:</span> {{ formatDate(announcement.panDt) }}</p>
            <p v-if="announcement.clsgDt"><span class="font-medium">마감일:</span> {{ formatDate(announcement.clsgDt) }}</p>
          </div>
        </div>
      </section>

      <main class="mx-auto max-w-5xl px-4 py-5 md:px-6 md:py-6 space-y-5">
        <!-- 공급 일정 -->
        <SectionBlock heading="공급 일정" data-test-section="schedule">
          <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <template v-if="announcement.acpDttm">
              <dt class="text-slate-500 font-medium">접수기간</dt>
              <dd class="text-slate-900">{{ announcement.acpDttm }}</dd>
            </template>
            <template v-if="announcement.pzwrAncDt">
              <dt class="text-slate-500 font-medium">당첨자발표</dt>
              <dd class="text-slate-900">{{ announcement.pzwrAncDt }}</dd>
            </template>
            <template v-if="documentRange">
              <dt class="text-slate-500 font-medium">서류제출</dt>
              <dd class="text-slate-900">{{ documentRange }}</dd>
            </template>
            <template v-if="contractRange">
              <dt class="text-slate-500 font-medium">계약기간</dt>
              <dd class="text-slate-900">{{ contractRange }}</dd>
            </template>
            <template v-if="announcement.hsSbscAcpTrgCdNm">
              <dt class="text-slate-500 font-medium">청약 대상</dt>
              <dd class="text-slate-900">{{ announcement.hsSbscAcpTrgCdNm }}</dd>
            </template>
          </dl>
          <p v-if="announcement.splScdlGudFcts" class="mt-3 text-xs text-slate-500 whitespace-pre-line">
            {{ announcement.splScdlGudFcts }}
          </p>
        </SectionBlock>

        <!-- 단지 정보 -->
        <SectionBlock heading="단지 정보" data-test-section="complex">
          <dl class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <template v-if="announcement.bzdtNm">
              <dt class="text-slate-500 font-medium">단지명</dt>
              <dd class="text-slate-900">{{ announcement.bzdtNm }}</dd>
            </template>
            <template v-if="announcement.lctAraAdr">
              <dt class="text-slate-500 font-medium">주소</dt>
              <dd class="text-slate-900">
                {{ announcement.lctAraAdr }}<span v-if="announcement.lctAraDtlAdr"> ({{ announcement.lctAraDtlAdr }})</span>
              </dd>
            </template>
            <template v-if="announcement.sumTotHshCnt !== null">
              <dt class="text-slate-500 font-medium">총세대수</dt>
              <dd class="text-slate-900">{{ announcement.sumTotHshCnt!.toLocaleString() }}세대</dd>
            </template>
            <template v-if="announcement.minMaxRsdnDdoAr">
              <dt class="text-slate-500 font-medium">전용면적</dt>
              <dd class="text-slate-900">{{ announcement.minMaxRsdnDdoAr }}㎡</dd>
            </template>
            <template v-if="announcement.htnFmlaDsCdNm">
              <dt class="text-slate-500 font-medium">주택형식</dt>
              <dd class="text-slate-900">{{ announcement.htnFmlaDsCdNm }}</dd>
            </template>
            <template v-if="announcement.mvinXpcYm">
              <dt class="text-slate-500 font-medium">입주예정</dt>
              <dd class="text-slate-900">{{ announcement.mvinXpcYm }}</dd>
            </template>
          </dl>
          <div v-if="hasFacilityInfo" class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div v-if="announcement.edcFclCts" class="rounded-lg bg-slate-50 p-3">
              <p class="font-medium text-slate-700 mb-1">교육 시설</p>
              <p class="text-slate-600 whitespace-pre-line">{{ announcement.edcFclCts }}</p>
            </div>
            <div v-if="announcement.tffcFclCts" class="rounded-lg bg-slate-50 p-3">
              <p class="font-medium text-slate-700 mb-1">교통 시설</p>
              <p class="text-slate-600 whitespace-pre-line">{{ announcement.tffcFclCts }}</p>
            </div>
            <div v-if="announcement.cvnFclCts" class="rounded-lg bg-slate-50 p-3">
              <p class="font-medium text-slate-700 mb-1">편의 시설</p>
              <p class="text-slate-600 whitespace-pre-line">{{ announcement.cvnFclCts }}</p>
            </div>
            <div v-if="announcement.idtFclCts" class="rounded-lg bg-slate-50 p-3">
              <p class="font-medium text-slate-700 mb-1">부대 시설</p>
              <p class="text-slate-600 whitespace-pre-line">{{ announcement.idtFclCts }}</p>
            </div>
          </div>
          <ClientOnly v-if="hasCoordinates">
            <div class="mt-4 h-[280px] w-full rounded-lg overflow-hidden bg-slate-100">
              <KakaoMap :center="mapCenter" :level="4" />
            </div>
          </ClientOnly>
        </SectionBlock>

        <!-- 평형별 공급 테이블 -->
        <SectionBlock
          v-if="announcement.supplies && announcement.supplies.length > 0"
          heading="평형별 공급"
          data-test-section="supplies"
        >
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-200 bg-slate-50">
                  <th class="text-left p-2 font-medium text-slate-700">주택형</th>
                  <th class="text-right p-2 font-medium text-slate-700">전용면적</th>
                  <th class="text-right p-2 font-medium text-slate-700">공급면적</th>
                  <th class="text-right p-2 font-medium text-slate-700">세대수</th>
                  <th class="text-right p-2 font-medium text-slate-700">{{ supplyAmountHeader }}</th>
                  <th v-if="hasMonthlyRent" class="text-right p-2 font-medium text-slate-700">월임대료</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="supply in announcement.supplies"
                  :key="supply.id"
                  class="border-b border-slate-100"
                >
                  <td class="p-2 text-slate-900">{{ supply.htyNm ?? '-' }}</td>
                  <td class="p-2 text-right text-slate-700">{{ supply.rsdnDdoAr !== null ? `${supply.rsdnDdoAr}㎡` : '-' }}</td>
                  <td class="p-2 text-right text-slate-700">{{ supply.splAr !== null ? `${supply.splAr}㎡` : '-' }}</td>
                  <td class="p-2 text-right text-slate-700">{{ supply.silHshCnt?.toLocaleString() ?? '-' }}</td>
                  <td class="p-2 text-right text-slate-900 font-medium">{{ formatSupplyAmount(supply) }}</td>
                  <td v-if="hasMonthlyRent" class="p-2 text-right text-slate-700">{{ supply.mmRfe ? formatWon(supply.mmRfe) : '-' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionBlock>

        <!-- 접수처 -->
        <SectionBlock
          v-if="announcement.ctrtPlcAdr || announcement.silOfcTlno || announcement.silOfcGudFcts"
          heading="접수처 / 문의"
          data-test-section="contact"
        >
          <dl class="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-x-6 gap-y-2 text-sm">
            <template v-if="announcement.ctrtPlcAdr">
              <dt class="text-slate-500 font-medium">주소</dt>
              <dd class="text-slate-900">{{ announcement.ctrtPlcAdr }}<span v-if="announcement.ctrtPlcDtlAdr"> ({{ announcement.ctrtPlcDtlAdr }})</span></dd>
            </template>
            <template v-if="announcement.silOfcTlno">
              <dt class="text-slate-500 font-medium">전화</dt>
              <dd class="text-slate-900">{{ announcement.silOfcTlno }}</dd>
            </template>
            <template v-if="announcement.silOfcGudFcts">
              <dt class="text-slate-500 font-medium">안내</dt>
              <dd class="text-slate-700 whitespace-pre-line">{{ announcement.silOfcGudFcts }}</dd>
            </template>
          </dl>
        </SectionBlock>

        <!-- 공고 본문 -->
        <SectionBlock
          v-if="announcement.panDtlCts"
          heading="공고 본문"
          data-test-section="body"
        >
          <p class="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{{ announcement.panDtlCts }}</p>
          <p v-if="announcement.etcFcts" class="mt-3 text-xs text-slate-500 whitespace-pre-wrap">
            {{ announcement.etcFcts }}
          </p>
        </SectionBlock>

        <!-- 첨부파일 -->
        <SectionBlock
          v-if="hasAttachments"
          heading="첨부파일"
          data-test-section="attachments"
        >
          <ul class="space-y-2">
            <li v-for="att in announcement.attachments" :key="att.id">
              <a
                :href="att.ahflUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <span class="material-symbols-outlined text-[18px]">download</span>
                <span>{{ att.cmnAhflNm }}</span>
                <span v-if="att.slPanAhflDsCdNm" class="text-xs text-slate-500">({{ att.slPanAhflDsCdNm }})</span>
              </a>
            </li>
          </ul>
        </SectionBlock>

        <!-- 원본 공고 링크 -->
        <p v-if="announcement.dtlUrl" class="text-xs text-slate-500 text-center">
          <a :href="announcement.dtlUrl" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">
            원본 공고 보기
          </a>
        </p>
      </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useStructuredData } from '~/composables/useStructuredData'
import type { LhAnnouncement, LhAnnouncementSupply } from '~/types/lhAnnouncement'

interface ApiEnvelope<T> { success: boolean; data: T }

const route = useRoute()
const idParam = route.params.id as string
const id = Number(idParam)
if (!Number.isFinite(id) || id <= 0) {
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 LH 공고입니다' })
}

const apiBase = useApiBase()
const { data, pending, error } = useAsyncData<ApiEnvelope<LhAnnouncement>>(
  `lh-announcement-${id}`,
  () => $fetch<ApiEnvelope<LhAnnouncement>>(`${apiBase}/api/lh-announcement/${id}`),
)

watchEffect(() => {
  if (error.value || (data.value && data.value.success === false)) {
    throw createError({ statusCode: 404, statusMessage: '존재하지 않는 LH 공고입니다' })
  }
})

const announcement = computed<LhAnnouncement | null>(() => data.value?.data ?? null)

const isRental = computed(() => (announcement.value?.uppAisTpNm ?? '').includes('임대'))

const typeBadgeClass = computed(() => {
  const base = 'px-2 py-1 rounded font-medium'
  if (isRental.value) return `${base} bg-amber-100 text-amber-700`
  return `${base} bg-blue-100 text-blue-700`
})

const statusLabel = computed(() => announcement.value?.panSs ?? '')

const statusBadgeClass = computed(() => {
  const baseClass = 'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0'
  if (announcement.value?.panSs === '공고중') {
    return `${baseClass} bg-green-100 text-green-700 ring-1 ring-inset ring-green-200`
  }
  if (announcement.value?.panSs === '마감') {
    return `${baseClass} bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200`
  }
  return `${baseClass} bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200`
})

const documentRange = computed(() => {
  if (!announcement.value) return null
  const start = announcement.value.pzwrPprSbmStDt
  const end = announcement.value.pzwrPprSbmEdDt
  if (!start && !end) return null
  return [start, end].filter(Boolean).join(' ~ ')
})

const contractRange = computed(() => {
  if (!announcement.value) return null
  const start = announcement.value.ctrtStDt
  const end = announcement.value.ctrtEdDt
  if (!start && !end) return null
  return [start, end].filter(Boolean).join(' ~ ')
})

const hasFacilityInfo = computed(() => {
  if (!announcement.value) return false
  return Boolean(
    announcement.value.edcFclCts ||
      announcement.value.tffcFclCts ||
      announcement.value.cvnFclCts ||
      announcement.value.idtFclCts,
  )
})

const hasCoordinates = computed(() => {
  return Boolean(announcement.value && announcement.value.lat !== null && announcement.value.lng !== null)
})

const mapCenter = computed(() => {
  if (!announcement.value || announcement.value.lat === null || announcement.value.lng === null) return null
  return { lat: announcement.value.lat, lng: announcement.value.lng }
})

const supplyAmountHeader = computed(() => {
  const supplies = announcement.value?.supplies ?? []
  const isSale = supplies.some((s) => s.listType === '01')
  return isSale ? '분양가' : '임대보증금'
})

const hasMonthlyRent = computed(() => {
  const supplies = announcement.value?.supplies ?? []
  return supplies.some((s) => s.mmRfe !== null && s.mmRfe > 0)
})

const hasAttachments = computed(() => {
  return Boolean(announcement.value?.attachments && announcement.value.attachments.length > 0)
})

function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${y}.${m}.${day}`
}

function formatWon(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000)
    const man = Math.floor((amount % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`
  }
  return `${Math.floor(amount / 10_000).toLocaleString()}만원`
}

function formatSupplyAmount(supply: LhAnnouncementSupply): string {
  if (supply.silAmt !== null && supply.silAmt > 0) return formatWon(supply.silAmt)
  if (supply.lsGmy !== null && supply.lsGmy > 0) return formatWon(supply.lsGmy)
  if (supply.elyDsuAmt !== null && supply.elyDsuAmt > 0) return formatWon(supply.elyDsuAmt)
  return '-'
}

const canonicalUrl = `${SITE_URL}/subscription/rent/lh/announcement/${id}`
const fallbackTitle = 'LH 공고 | 일상킷'
const fallbackDescription = 'LH 가 직접 공급하는 분양·임대 공고 상세 정보를 확인하세요.'

useHead(() => {
  const ann = announcement.value
  const title = ann ? `${ann.panNm} | LH 공고 | 일상킷` : fallbackTitle
  const description = ann
    ? `${ann.cnpNm} ${ann.uppAisTpNm} 공고 - ${ann.panNm}. 공고일/마감일/평형별 공급 정보를 한눈에 확인하세요.`
    : fallbackDescription
  return {
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
  }
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '임대', url: `${SITE_URL}/subscription/rent` },
  { name: 'LH 분양/임대 공고', url: `${SITE_URL}/subscription/rent/lh-announcement` },
  { name: announcement.value?.panNm ?? 'LH 공고', url: canonicalUrl },
])
</script>
