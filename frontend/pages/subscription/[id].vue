<template>
  <div class="bg-background-light">
    <!-- Loading State -->
    <div v-if="pending" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p class="text-slate-600">로딩 중...</p>
      </div>
    </div>

    <template v-else-if="subscription">
      <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <!-- Breadcrumb -->
        <nav class="hidden md:flex items-center gap-1 text-sm text-slate-500 mb-4">
          <NuxtLink to="/" class="hover:text-primary">홈</NuxtLink>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          <NuxtLink to="/subscription" class="hover:text-primary">청약</NuxtLink>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          <span class="text-slate-800">{{ subscription.houseName }}</span>
        </nav>

        <!-- Header -->
        <div class="mb-8">
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex-1">
              <h1 class="text-2xl md:text-3xl font-bold text-slate-900">{{ subscription.houseName }}</h1>
              <p class="text-slate-500 text-sm mt-2">{{ subscription.supplyLocation || subscription.regionName }}</p>
            </div>
            <span :class="statusBadgeClass">
              {{ getStatusLabel(subscription.status) }}
            </span>
          </div>
          <!-- 핵심 요약 -->
          <div class="flex flex-wrap gap-4 mt-4 text-sm">
            <div v-if="subscription.totalSupplyCount" class="flex items-center gap-1.5 text-slate-700">
              <span class="material-symbols-outlined text-[18px] text-primary">apartment</span>
              <span class="font-semibold">{{ subscription.totalSupplyCount.toLocaleString() }}호</span> 공급
            </div>
            <div v-if="subscription.constructorName" class="flex items-center gap-1.5 text-slate-700">
              <span class="material-symbols-outlined text-[18px] text-primary">business</span>
              {{ subscription.constructorName }}
            </div>
            <div v-if="subscription.moveInMonth" class="flex items-center gap-1.5 text-slate-700">
              <span class="material-symbols-outlined text-[18px] text-primary">calendar_month</span>
              {{ formatMoveInMonth(subscription.moveInMonth) }} 입주
            </div>
            <div v-if="subscription.houseDetailType" class="flex items-center gap-1.5 text-slate-700">
              <span class="material-symbols-outlined text-[18px] text-primary">sell</span>
              {{ subscription.houseDetailType }}
            </div>
          </div>
        </div>

        <!-- 1. 면적별 공급정보 테이블 (핵심) -->
        <div v-if="unitTypes && unitTypes.length > 0" class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
          <h2 class="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">home</span>
            면적별 공급정보
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="text-left py-3 px-4 font-semibold text-slate-800">주택형</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">전용면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">공급면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">일반공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">특별공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">합계</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">분양최고가</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in unitTypes" :key="unit.id" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-3 px-4 text-slate-900 font-medium">{{ formatHouseType(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ formatExclusiveArea(unit.houseType) }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ formatSupplyArea(unit.supplyArea) }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ unit.generalCount?.toLocaleString() || '-' }}호</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ unit.specialCount?.toLocaleString() || '-' }}호</td>
                  <td class="py-3 px-4 text-primary font-bold text-right">{{ ((unit.generalCount || 0) + (unit.specialCount || 0)).toLocaleString() }}호</td>
                  <td class="py-3 px-4 text-slate-900 font-semibold text-right">
                    {{ unit.topAmount ? formatPrice(unit.topAmount) : '-' }}
                  </td>
                </tr>
              </tbody>
              <tfoot v-if="unitTypes.length > 1">
                <tr class="border-t-2 border-slate-300 bg-slate-50">
                  <td class="py-3 px-4 font-bold text-slate-800" colspan="3">합계</td>
                  <td class="py-3 px-4 font-bold text-slate-800 text-right">{{ totalGeneral.toLocaleString() }}호</td>
                  <td class="py-3 px-4 font-bold text-slate-800 text-right">{{ totalSpecial.toLocaleString() }}호</td>
                  <td class="py-3 px-4 font-bold text-primary text-right">{{ (totalGeneral + totalSpecial).toLocaleString() }}호</td>
                  <td class="py-3 px-4"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <!-- Ad: 면적별 테이블 아래 -->
        <AdBanner />

        <!-- 2. 특별공급 상세 -->
        <div v-if="hasSpecialSupply" class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
          <h2 class="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">info</span>
            특별공급 유형별 세대수
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div v-for="item in specialSupplyItems" :key="item.label" class="bg-slate-50 rounded-lg p-4 text-center border border-slate-100">
              <p class="text-xs text-slate-500 mb-1">{{ item.label }}</p>
              <p class="text-lg font-bold text-slate-900">{{ item.count.toLocaleString() }}<span class="text-xs font-normal text-slate-500 ml-0.5">호</span></p>
            </div>
          </div>
        </div>

        <!-- 3. 청약 일정 -->
        <div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
          <h2 class="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">schedule</span>
            청약 일정
          </h2>
          <div class="space-y-4">
            <TimelineItem
              v-if="subscription.announcementDate"
              title="모집공고"
              :date="subscription.announcementDate"
              icon="article"
            />
            <TimelineItem
              v-if="subscription.specialStartDate && subscription.specialEndDate"
              title="특별공급 접수"
              :date="`${subscription.specialStartDate} ~ ${subscription.specialEndDate}`"
              icon="edit_note"
            />
            <TimelineItem
              v-if="subscription.rank1AreaStartDate && subscription.rank1AreaEndDate"
              title="1순위 접수"
              :date="`${subscription.rank1AreaStartDate} ~ ${subscription.rank1AreaEndDate}`"
              icon="first_page"
            />
            <TimelineItem
              v-if="subscription.rank2AreaStartDate && subscription.rank2AreaEndDate"
              title="2순위 접수"
              :date="`${subscription.rank2AreaStartDate} ~ ${subscription.rank2AreaEndDate}`"
              icon="last_page"
            />
            <TimelineItem
              v-if="subscription.winnerDate"
              title="당첨자 발표"
              :date="subscription.winnerDate"
              icon="check_circle"
            />
            <TimelineItem
              v-if="subscription.contractStartDate && subscription.contractEndDate"
              title="계약 기간"
              :date="`${subscription.contractStartDate} ~ ${subscription.contractEndDate}`"
              icon="description"
            />
            <TimelineItem
              v-if="subscription.moveInMonth"
              title="입주 예정"
              :date="formatMoveInMonth(subscription.moveInMonth)"
              icon="home"
              :is-last="true"
            />
          </div>
        </div>

        <!-- 4. 기본정보 -->
        <div class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
          <h2 class="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">info</span>
            기본정보
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">주택유형</span>
              <span class="font-medium text-slate-900">{{ subscription.houseType }}</span>
            </div>
            <div v-if="subscription.houseDetailType" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">분양구분</span>
              <span class="font-medium text-slate-900">{{ subscription.houseDetailType }}</span>
            </div>
            <div v-if="subscription.supplyLocation" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">공급위치</span>
              <span class="font-medium text-slate-900">{{ subscription.supplyLocation }}</span>
            </div>
            <div v-if="subscription.totalSupplyCount" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">총 공급호수</span>
              <span class="font-medium text-slate-900">{{ subscription.totalSupplyCount.toLocaleString() }}호</span>
            </div>
            <div v-if="subscription.constructorName" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">시공사</span>
              <span class="font-medium text-slate-900">{{ subscription.constructorName }}</span>
            </div>
            <div v-if="subscription.developerName" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">시행사</span>
              <span class="font-medium text-slate-900">{{ subscription.developerName }}</span>
            </div>
            <div v-if="subscription.moveInMonth" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">입주예정</span>
              <span class="font-medium text-slate-900">{{ formatMoveInMonth(subscription.moveInMonth) }}</span>
            </div>
            <div v-if="subscription.inquiryTel" class="flex justify-between py-2 border-b border-slate-100">
              <span class="text-slate-500">문의전화</span>
              <a :href="`tel:${subscription.inquiryTel}`" class="font-medium text-primary hover:underline">{{ subscription.inquiryTel }}</a>
            </div>
          </div>
        </div>

        <!-- 5. 링크 -->
        <div class="flex flex-col md:flex-row gap-4 mb-8">
          <a
            v-if="subscription.homepage"
            :href="subscription.homepage"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
          >
            <span class="material-symbols-outlined text-[20px]">explore</span>
            공식 홈페이지
          </a>
          <a
            v-if="subscription.pblancUrl"
            :href="subscription.pblancUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <span class="material-symbols-outlined text-[20px]">description</span>
            청약홈 공고 보기
          </a>
        </div>

        <!-- Ad -->
        <AdBanner />
      </main>
    </template>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
        </div>
        <p class="text-red-700 font-semibold">청약 정보를 불러올 수 없습니다</p>
        <NuxtLink
          to="/subscription"
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          목록으로
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import type { Subscription, SubscriptionUnitType } from '~/types/subscription'
import { useSubscription } from '~/composables/useSubscription'
import { useStructuredData } from '~/composables/useStructuredData'

const route = useRoute()
const id = Number(route.params.id)

const { getSubscriptionDetail } = useSubscription()

const subscription = ref<Subscription | null>(null)
const unitTypes = ref<SubscriptionUnitType[]>([])
const pending = ref(false)
const error = ref<string | null>(null)

const statusBadgeClass = computed(() => {
  if (!subscription.value) return ''
  const status = subscription.value.status
  const baseClass = 'inline-flex items-center px-3 py-1.5 rounded-full text-sm font-bold'
  if (status === 'upcoming') return `${baseClass} bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200`
  if (status === 'ongoing') return `${baseClass} bg-green-100 text-green-700 ring-1 ring-inset ring-green-200`
  return `${baseClass} bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200`
})

// 합계 계산
const totalGeneral = computed(() => unitTypes.value.reduce((sum, u) => sum + (u.generalCount || 0), 0))
const totalSpecial = computed(() => unitTypes.value.reduce((sum, u) => sum + (u.specialCount || 0), 0))

// 특별공급 합산
const totalSpecialCount = computed(() => ({
  newlyweds: unitTypes.value.reduce((s, u) => s + (u.newlywedsCount || 0), 0),
  multiChild: unitTypes.value.reduce((s, u) => s + (u.multiChildCount || 0), 0),
  firstLife: unitTypes.value.reduce((s, u) => s + (u.firstLifeCount || 0), 0),
  elderly: unitTypes.value.reduce((s, u) => s + (u.elderlyCount || 0), 0),
  institution: unitTypes.value.reduce((s, u) => s + (u.institutionCount || 0), 0),
  youth: unitTypes.value.reduce((s, u) => s + (u.youthCount || 0), 0),
  newborn: unitTypes.value.reduce((s, u) => s + (u.newbornCount || 0), 0),
  transfer: unitTypes.value.reduce((s, u) => s + (u.transferCount || 0), 0),
  etc: unitTypes.value.reduce((s, u) => s + (u.etcCount || 0), 0),
}))

const specialSupplyItems = computed(() => {
  const t = totalSpecialCount.value
  return [
    { label: '신혼부부', count: t.newlyweds },
    { label: '다자녀', count: t.multiChild },
    { label: '생애최초', count: t.firstLife },
    { label: '노부모부양', count: t.elderly },
    { label: '기관추천', count: t.institution },
    { label: '청년', count: t.youth },
    { label: '신생아', count: t.newborn },
    { label: '이전기관', count: t.transfer },
    { label: '기타', count: t.etc },
  ].filter(item => item.count > 0)
})

const hasSpecialSupply = computed(() => specialSupplyItems.value.length > 0)

// 포맷 함수들
function getStatusLabel(status: string): string {
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '접수중'
  return '마감'
}

function formatMoveInMonth(month: string): string {
  if (month.length === 6) {
    return `${month.substring(0, 4)}년 ${parseInt(month.substring(4, 6))}월`
  }
  return month
}

function formatHouseType(type: string | null): string {
  if (!type) return '-'
  // "084.9421A" → "84A"
  const match = type.match(/^0?(\d+)\.?\d*([A-Z]?)$/)
  if (match) return `${match[1]}${match[2]}`
  return type
}

function formatExclusiveArea(houseType: string | null): string {
  if (!houseType) return '-'
  // "084.9421A" → 전용 84.94㎡ (약 25.7평)
  const match = houseType.match(/^0?(\d+\.\d+)/)
  if (match) {
    const sqm = parseFloat(match[1])
    const pyeong = (sqm / 3.3058).toFixed(0)
    return `${sqm.toFixed(1)}㎡ (${pyeong}평)`
  }
  return '-'
}

function formatSupplyArea(area: string | null): string {
  if (!area) return '-'
  const sqm = parseFloat(area)
  if (isNaN(sqm)) return area
  const pyeong = (sqm / 3.3058).toFixed(0)
  return `${sqm.toFixed(1)}㎡ (${pyeong}평)`
}

function formatPrice(amount: number): string {
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000)
    const man = amount % 10000
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억`
  }
  return `${amount.toLocaleString()}만원`
}

// SSR: Load initial data
const { data } = await useAsyncData(`subscription-${id}`, () =>
  getSubscriptionDetail(id)
)

if (data.value) {
  const { unitTypes: units, ...sub } = data.value
  subscription.value = sub
  unitTypes.value = units || []
}

const { setBreadcrumbSchema } = useStructuredData()

if (subscription.value) {
  setBreadcrumbSchema([
    { name: '홈', url: SITE_URL },
    { name: '청약 정보', url: `${SITE_URL}/subscription` },
    { name: subscription.value.houseName, url: `${SITE_URL}/subscription/${id}` },
  ])
}

// SEO
useSeoMeta({
  title: subscription.value ? `${subscription.value.houseName} 청약 분양정보 - 일상킷` : '청약 정보 - 일상킷',
  description: subscription.value
    ? `${subscription.value.houseName} ${subscription.value.houseType} 청약 일정, 면적별 공급정보, 분양가를 확인하세요.`
    : '청약 분양정보를 확인하세요.',
  ogTitle: subscription.value ? `${subscription.value.houseName} 청약 - ${subscription.value.regionName}` : '청약 정보',
  ogDescription: subscription.value
    ? `${subscription.value.houseName} ${subscription.value.houseType} 청약 정보`
    : '청약 분양정보',
  ogImage: DEFAULT_OG_IMAGE,
  ogUrl: `${SITE_URL}/subscription/${id}`,
  ogSiteName: SITE_NAME,
})

useHead({
  link: [{ rel: 'canonical', href: `${SITE_URL}/subscription/${id}` }],
})
</script>
