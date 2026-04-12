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
      <!-- Breadcrumb -->
      <nav class="hidden md:flex items-center gap-1 text-sm text-slate-500 px-4 py-4 md:px-6 mx-auto max-w-6xl">
        <NuxtLink to="/" class="hover:text-primary">홈</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <NuxtLink to="/subscription" class="hover:text-primary">청약</NuxtLink>
        <span class="material-symbols-outlined text-[14px]">chevron_right</span>
        <span class="text-slate-800">{{ subscription.houseName }}</span>
      </nav>

      <!-- Header -->
      <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100 px-4 md:px-6">
        <div class="mx-auto max-w-6xl py-6">
          <div class="flex items-start justify-between gap-4 mb-3">
            <div class="flex-1">
              <h1 class="text-2xl md:text-3xl font-bold text-slate-900">{{ subscription.houseName }}</h1>
              <p class="text-slate-500 text-sm mt-2">{{ subscription.regionName }}</p>
            </div>
            <span :class="statusBadgeClass">
              {{ getStatusLabel(subscription.status) }}
            </span>
          </div>
        </div>
      </div>

      <main class="mx-auto max-w-6xl px-4 md:px-6 py-8">
        <!-- Basic Info Card -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <h3 class="font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">info</span>
              기본정보
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <p class="text-slate-500">주택형</p>
                <p class="font-medium text-slate-900">{{ subscription.houseType }}</p>
              </div>
              <div v-if="subscription.houseDetailType">
                <p class="text-slate-500">주택 분류</p>
                <p class="font-medium text-slate-900">{{ subscription.houseDetailType }}</p>
              </div>
              <div v-if="subscription.supplyLocation">
                <p class="text-slate-500">공급위치</p>
                <p class="font-medium text-slate-900">{{ subscription.supplyLocation }}</p>
              </div>
              <div v-if="subscription.totalSupplyCount">
                <p class="text-slate-500">총 공급호수</p>
                <p class="font-medium text-slate-900">{{ subscription.totalSupplyCount.toLocaleString() }}호</p>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
            <h3 class="font-semibold text-slate-800 text-sm mb-4 flex items-center gap-2">
              <span class="material-symbols-outlined text-primary text-[20px]">business</span>
              시공사·분양사
            </h3>
            <div class="space-y-3 text-sm">
              <div v-if="subscription.constructorName">
                <p class="text-slate-500">시공사</p>
                <p class="font-medium text-slate-900">{{ subscription.constructorName }}</p>
              </div>
              <div v-if="subscription.developerName">
                <p class="text-slate-500">분양사</p>
                <p class="font-medium text-slate-900">{{ subscription.developerName }}</p>
              </div>
              <div v-if="subscription.inquiryTel">
                <p class="text-slate-500">문의전화</p>
                <p class="font-medium text-slate-900">{{ subscription.inquiryTel }}</p>
              </div>
              <div v-if="subscription.moveInMonth">
                <p class="text-slate-500">입주예정월</p>
                <p class="font-medium text-slate-900">{{ formatMoveInMonth(subscription.moveInMonth) }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Timeline Section -->
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
              icon="newspaper"
            />
            <TimelineItem
              v-if="subscription.specialStartDate && subscription.specialEndDate"
              title="특별공급 접수"
              :date="`${subscription.specialStartDate} ~ ${subscription.specialEndDate}`"
              icon="people"
            />
            <TimelineItem
              v-if="subscription.rank1AreaStartDate && subscription.rank1AreaEndDate"
              title="1순위 접수"
              :date="`${subscription.rank1AreaStartDate} ~ ${subscription.rank1AreaEndDate}`"
              icon="group"
            />
            <TimelineItem
              v-if="subscription.rank2AreaStartDate && subscription.rank2AreaEndDate"
              title="2순위 접수"
              :date="`${subscription.rank2AreaStartDate} ~ ${subscription.rank2AreaEndDate}`"
              icon="groups"
            />
            <TimelineItem
              v-if="subscription.winnerDate"
              title="당첨자 발표"
              :date="subscription.winnerDate"
              icon="celebration"
            />
            <TimelineItem
              v-if="subscription.contractStartDate && subscription.contractEndDate"
              title="계약 기간"
              :date="`${subscription.contractStartDate} ~ ${subscription.contractEndDate}`"
              icon="description"
            />
          </div>
        </div>

        <!-- Special Supply Breakdown -->
        <div v-if="hasSpecialSupply" class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
          <h2 class="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">pie_chart</span>
            특별공급 분류
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <SpecialSupplyCard
              v-if="totalSpecialCount.newlyweds > 0"
              label="신혼부부"
              :count="totalSpecialCount.newlyweds"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.multiChild > 0"
              label="다자녀"
              :count="totalSpecialCount.multiChild"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.firstLife > 0"
              label="생애최초"
              :count="totalSpecialCount.firstLife"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.elderly > 0"
              label="노부모부양"
              :count="totalSpecialCount.elderly"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.institution > 0"
              label="기관추천"
              :count="totalSpecialCount.institution"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.youth > 0"
              label="청년"
              :count="totalSpecialCount.youth"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.newborn > 0"
              label="신생아"
              :count="totalSpecialCount.newborn"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.transfer > 0"
              label="전환"
              :count="totalSpecialCount.transfer"
            />
            <SpecialSupplyCard
              v-if="totalSpecialCount.etc > 0"
              label="기타"
              :count="totalSpecialCount.etc"
            />
          </div>
        </div>

        <!-- Unit Types Table -->
        <div v-if="unitTypes && unitTypes.length > 0" class="bg-white rounded-xl p-6 border border-slate-200 shadow-sm mb-8">
          <h2 class="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">table_chart</span>
            주택형별 공급내역
          </h2>
          <div class="overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b-2 border-slate-200">
                  <th class="text-left py-3 px-4 font-semibold text-slate-800">주택형</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">공급면적</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">일반공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">특별공급</th>
                  <th class="text-right py-3 px-4 font-semibold text-slate-800">분양최고가</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="unit in unitTypes" :key="unit.id" class="border-b border-slate-100 hover:bg-slate-50">
                  <td class="py-3 px-4 text-slate-900 font-medium">{{ unit.houseType || '-' }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ unit.supplyArea || '-' }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ unit.generalCount || '-' }}</td>
                  <td class="py-3 px-4 text-slate-600 text-right">{{ unit.specialCount || '-' }}</td>
                  <td class="py-3 px-4 text-slate-900 font-medium text-right">
                    {{ unit.topAmount ? `${unit.topAmount.toLocaleString()}만원` : '-' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Links -->
        <div class="flex flex-col md:flex-row gap-4">
          <a
            v-if="subscription.homepage"
            :href="subscription.homepage"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            <span class="material-symbols-outlined text-[20px]">language</span>
            공식 홈페이지
          </a>
          <a
            v-if="subscription.pblancUrl"
            :href="subscription.pblancUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-white border border-slate-200 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span class="material-symbols-outlined text-[20px]">description</span>
            청약홈 공고
          </a>
        </div>
      </main>
    </template>

    <!-- Error State -->
    <div v-else-if="error" class="flex items-center justify-center py-20 min-h-[400px]">
      <div class="text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
        </div>
        <p class="text-red-700 font-semibold">청약 정보를 불러올 수 없습니다</p>
        <button
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          @click="$router.back()"
        >
          <span class="material-symbols-outlined text-[16px]">arrow_back</span>
          돌아가기
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import type { Subscription, SubscriptionUnitType } from '~/types/subscription'

const route = useRoute()
const id = Number(route.params.id)

import { useSubscription } from '~/composables/useSubscription'

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
  return `${baseClass} bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200`
})

const totalSpecialCount = computed(() => ({
  newlyweds: unitTypes.value.reduce((sum, u) => sum + (u.newlywedsCount || 0), 0),
  multiChild: unitTypes.value.reduce((sum, u) => sum + (u.multiChildCount || 0), 0),
  firstLife: unitTypes.value.reduce((sum, u) => sum + (u.firstLifeCount || 0), 0),
  elderly: unitTypes.value.reduce((sum, u) => sum + (u.elderlyCount || 0), 0),
  institution: unitTypes.value.reduce((sum, u) => sum + (u.institutionCount || 0), 0),
  youth: unitTypes.value.reduce((sum, u) => sum + (u.youthCount || 0), 0),
  newborn: unitTypes.value.reduce((sum, u) => sum + (u.newbornCount || 0), 0),
  transfer: unitTypes.value.reduce((sum, u) => sum + (u.transferCount || 0), 0),
  etc: unitTypes.value.reduce((sum, u) => sum + (u.etcCount || 0), 0),
}))

const hasSpecialSupply = computed(() =>
  Object.values(totalSpecialCount.value).some(count => count > 0)
)

async function loadDetail() {
  pending.value = true
  error.value = null
  try {
    const result = await getSubscriptionDetail(id)
    const { unitTypes: units, ...sub } = result
    subscription.value = sub
    unitTypes.value = units || []

    // Update SEO
    const title = `${subscription.value.houseName} 청약 - ${subscription.value.regionName}`
    const description = `${subscription.value.houseName} ${subscription.value.houseType} 청약 정보와 일정을 확인하세요.`
    useHead({
      title,
      meta: [
        { name: 'description', content: description },
        { property: 'og:title', content: title },
        { property: 'og:description', content: description },
        { property: 'og:image', content: DEFAULT_OG_IMAGE },
        { property: 'og:url', content: `${SITE_URL}/subscription/${id}` },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: SITE_NAME },
      ],
      link: [
        { rel: 'canonical', href: `${SITE_URL}/subscription/${id}` },
      ],
    })
  } catch (err) {
    error.value = '청약 정보를 불러올 수 없습니다'
    console.error('Failed to load subscription detail:', err)
  } finally {
    pending.value = false
  }
}

function getStatusLabel(status: string): string {
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '접수중'
  if (status === 'closed') return '마감'
  return ''
}

function formatMoveInMonth(month: string): string {
  if (month.length === 6) {
    const year = month.substring(0, 4)
    const m = month.substring(4, 6)
    return `${year}년 ${parseInt(m)}월`
  }
  return month
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
</script>
