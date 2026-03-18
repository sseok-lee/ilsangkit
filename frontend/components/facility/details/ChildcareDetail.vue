<template>
  <div class="space-y-3">
    <!-- 유형 + 운영상태 뱃지 -->
    <div class="flex items-center gap-2 flex-wrap">
      <span
        v-if="details.crtypename"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="childcareTypeBadgeClass"
      >
        <span class="text-xs opacity-70 mr-1">유형</span> {{ details.crtypename }}
      </span>
      <span
        v-if="details.crstatusname"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="childcareStatusBadgeClass"
      >
        <span class="text-xs opacity-70 mr-1">상태</span> {{ details.crstatusname }}
      </span>
    </div>

    <!-- 휴지 기간 -->
    <div v-if="details.crpausebegindt && details.crpauseenddt" class="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
      휴지 기간: {{ details.crpausebegindt }} ~ {{ details.crpauseenddt }}
    </div>

    <!-- 정원·현원 -->
    <div v-if="details.crcapat != null && details.crchcnt != null" class="flex flex-col gap-2">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">정원</span>
        <span class="text-sm font-medium text-gray-900">{{ details.crcapat }}명</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">현원</span>
        <span class="text-sm font-medium text-gray-900">{{ details.crchcnt }}명</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">가용률</span>
        <span class="text-sm font-medium" :class="availabilityRateClass">{{ availabilityRate }}</span>
      </div>
      <!-- 가용률 Progress Bar -->
      <div class="w-full bg-gray-200 rounded-full h-2">
        <div
          class="h-2 rounded-full transition-all"
          :class="occupancyBarClass"
          :style="{ width: occupancyPercent + '%' }"
        />
      </div>
      <p class="text-xs text-gray-400 text-right">정원 대비 현원 {{ occupancyPercent }}%</p>
    </div>

    <!-- 기본 정보 -->
    <div class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">기본 정보</p>
      <div class="flex flex-col gap-2">
        <div v-if="details.crcnfmdt" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">인가일</span>
          <span class="text-sm font-medium text-gray-900">{{ details.crcnfmdt }}</span>
        </div>
        <div v-if="details.crtelno" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">연락처</span>
          <a :href="`tel:${details.crtelno}`" class="text-sm font-medium text-blue-600 hover:underline">{{ details.crtelno }}</a>
        </div>
        <div v-if="details.crrepname" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">대표자</span>
          <span class="text-sm font-medium text-gray-900">{{ details.crrepname }}</span>
        </div>
        <div v-if="details.crfaxno" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">팩스</span>
          <span class="text-sm font-medium text-gray-900">{{ details.crfaxno }}</span>
        </div>
        <div v-if="details.chcrtescnt != null" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">교직원 수</span>
          <span class="text-sm font-medium text-gray-900">{{ details.chcrtescnt }}명</span>
        </div>
      </div>
    </div>

    <!-- 시설 정보 -->
    <div v-if="hasFacilityInfo" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">시설 정보</p>
      <div class="flex flex-col gap-2">
        <div v-if="details.nrtrroomcnt != null" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">보육실</span>
          <span class="text-sm font-medium text-gray-900">{{ details.nrtrroomcnt }}개</span>
        </div>
        <div v-if="details.nrtrroomsize" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">보육실면적</span>
          <span class="text-sm font-medium text-gray-900">{{ details.nrtrroomsize }}</span>
        </div>
        <div v-if="details.plgrdco != null" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">놀이터</span>
          <span class="text-sm font-medium text-gray-900">{{ details.plgrdco }}개</span>
        </div>
        <div v-if="details.cctvinstlcnt != null" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">CCTV</span>
          <span class="text-sm font-medium text-gray-900">{{ details.cctvinstlcnt }}대</span>
        </div>
      </div>
    </div>

    <!-- 통학차량 -->
    <div v-if="details.crcargbname" class="pt-3 border-t border-gray-200 flex items-center justify-between">
      <span class="text-sm text-gray-600">통학차량</span>
      <span class="text-sm font-medium text-gray-900">{{ details.crcargbname }}</span>
    </div>

    <!-- 연령별 반·아동 현황 -->
    <div v-if="hasClassData" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">연령별 반·아동 현황</p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="py-1.5 pr-3 text-left text-gray-500 font-medium">연령</th>
              <th class="py-1.5 px-2 text-right text-gray-500 font-medium">반 수</th>
              <th class="py-1.5 px-2 text-right text-gray-500 font-medium">아동 수</th>
              <th class="py-1.5 pl-2 text-right text-gray-500 font-medium">반당 평균</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in classRows" :key="row.label" :class="row.label === '합계' ? 'bg-gray-50 font-semibold' : ''">
              <td class="py-1.5 pr-3 font-medium text-gray-700">{{ row.label }}</td>
              <td class="py-1.5 px-2 text-right text-gray-600">{{ row.classes != null ? row.classes + '개' : '-' }}</td>
              <td class="py-1.5 px-2 text-right text-gray-600">{{ row.children != null ? row.children + '명' : '-' }}</td>
              <td class="py-1.5 pl-2 text-right text-gray-600">{{ row.avg != null ? row.avg + '명' : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 직원 현황 -->
    <div v-if="hasStaffData" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">직원 현황</p>
      <div class="space-y-1">
        <div v-if="details.emCntTot" class="flex items-center justify-between text-sm border-b border-gray-100 pb-1 mb-1">
          <span class="text-gray-700 font-medium">직원 총수</span>
          <span class="text-gray-900 font-semibold">{{ details.emCntTot }}명</span>
        </div>
        <div v-for="role in staffRoles" :key="role.label" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">{{ role.label }}</span>
          <span class="text-gray-700 font-medium">{{ role.cnt }}명</span>
        </div>
      </div>
    </div>

    <!-- 교사 경력 분포 -->
    <div v-if="hasCareerData" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">교사 경력 분포</p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="item in careerItems"
          :key="item.label"
          class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
          :class="item.colorClass"
        >
          {{ item.label }}
          <span class="font-semibold">{{ item.cnt }}명</span>
        </span>
      </div>
    </div>

    <!-- 특이사항 -->
    <div v-if="details.crspec" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-1">특이사항</p>
      <p class="text-sm text-gray-600 bg-gray-50 border border-gray-200 rounded px-3 py-2">{{ details.crspec }}</p>
    </div>

    <!-- 홈페이지 -->
    <div v-if="details.crhome" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-1">홈페이지</p>
      <a
        :href="details.crhome"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-blue-600 hover:underline break-all"
      >
        {{ details.crhome }}
      </a>
    </div>

    <!-- 데이터 기준일 -->
    <div v-if="details.datastdrdt" class="pt-3 border-t border-gray-200">
      <p class="text-xs text-gray-400">데이터 기준일: {{ details.datastdrdt }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ChildcareDetails } from '~/types/facility'

const props = defineProps<{
  details: ChildcareDetails
}>()

const childcareTypeBadgeClass = computed(() => {
  const type = props.details.crtypename || ''
  if (type.includes('국공립')) return 'bg-blue-100 text-blue-800'
  if (type.includes('민간')) return 'bg-orange-100 text-orange-800'
  if (type.includes('가정')) return 'bg-green-100 text-green-800'
  if (type.includes('직장')) return 'bg-purple-100 text-purple-800'
  if (type.includes('협동')) return 'bg-teal-100 text-teal-800'
  return 'bg-gray-100 text-gray-800'
})

const childcareStatusBadgeClass = computed(() => {
  const status = props.details.crstatusname || ''
  if (status.includes('운영')) return 'bg-green-100 text-green-800'
  if (status.includes('휴지')) return 'bg-yellow-100 text-yellow-800'
  if (status.includes('폐지')) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
})

const availabilityRate = computed(() => {
  const cap = props.details.crcapat
  const cur = props.details.crchcnt
  if (cap == null || cur == null || cap === 0) return '-'
  return `${((cap - cur) / cap * 100).toFixed(0)}%`
})

const occupancyPercent = computed(() => {
  const cap = props.details.crcapat
  const cur = props.details.crchcnt
  if (cap == null || cur == null || cap === 0) return 0
  return Math.min(Math.round((cur / cap) * 100), 100)
})

const occupancyBarClass = computed(() => {
  const pct = occupancyPercent.value
  if (pct >= 90) return 'bg-red-400'
  if (pct >= 70) return 'bg-yellow-400'
  return 'bg-green-400'
})

const availabilityRateClass = computed(() => {
  const cap = props.details.crcapat
  const cur = props.details.crchcnt
  if (cap == null || cur == null || cap === 0) return 'text-gray-900'
  const pct = (cap - cur) / cap * 100
  if (pct <= 10) return 'text-red-600'
  if (pct <= 30) return 'text-yellow-600'
  return 'text-green-600'
})

const hasFacilityInfo = computed(() => {
  const d = props.details
  return d.nrtrroomcnt != null || d.nrtrroomsize != null || d.plgrdco != null || d.cctvinstlcnt != null
})

// 연령별 반·아동 현황 테이블
const CLASS_DEFS = [
  { label: '0세', classKey: 'classCnt00', childKey: 'childCnt00' },
  { label: '1세', classKey: 'classCnt01', childKey: 'childCnt01' },
  { label: '2세', classKey: 'classCnt02', childKey: 'childCnt02' },
  { label: '3세', classKey: 'classCnt03', childKey: 'childCnt03' },
  { label: '4세', classKey: 'classCnt04', childKey: 'childCnt04' },
  { label: '5세', classKey: 'classCnt05', childKey: 'childCnt05' },
  { label: '만2세미만', classKey: 'classCntM2', childKey: 'childCntM2' },
  { label: '만5세이상', classKey: 'classCntM5', childKey: 'childCntM5' },
  { label: '장애아', classKey: 'classCntSp', childKey: 'childCntSp' },
  { label: '합계', classKey: 'classCntTot', childKey: 'childCntTot' },
] as const

const classRows = computed(() => {
  const d = props.details
  return CLASS_DEFS
    .map(({ label, classKey, childKey }) => {
      const classes = d[classKey] as number | undefined
      const children = d[childKey] as number | undefined
      const avg = (classes != null && classes > 0 && children != null) ? Math.round(children / classes * 10) / 10 : null
      return { label, classes, children, avg }
    })
    .filter(row => (row.classes != null && row.classes > 0) || (row.children != null && row.children > 0))
})

const hasClassData = computed(() => classRows.value.length > 0)

// 직원 현황 (직종별)
const STAFF_ROLE_DEFS = [
  { label: '원장', key: 'emCntA1' },
  { label: '보육교사', key: 'emCntA2' },
  { label: '특수교사', key: 'emCntA3' },
  { label: '치료사', key: 'emCntA4' },
  { label: '영양사', key: 'emCntA5' },
  { label: '간호사(조무사)', key: 'emCntA6' },
  { label: '조리원', key: 'emCntA10' },
  { label: '사무원', key: 'emCntA7' },
  { label: '기타', key: 'emCntA8' },
] as const

const staffRoles = computed(() => {
  const d = props.details
  return STAFF_ROLE_DEFS
    .map(({ label, key }) => ({ label, cnt: d[key] as number | undefined }))
    .filter(r => r.cnt != null && r.cnt > 0)
})

const hasStaffData = computed(() => {
  return props.details.emCntTot != null || staffRoles.value.length > 0
})

// 교사 경력 분포
const CAREER_COLORS = [
  'bg-sky-100 text-sky-800',
  'bg-blue-100 text-blue-800',
  'bg-indigo-100 text-indigo-800',
  'bg-violet-100 text-violet-800',
  'bg-purple-100 text-purple-800',
]

const careerItems = computed(() => {
  const d = props.details
  const defs = [
    { label: '1년 미만', key: 'emCnt0y' },
    { label: '1년 이상', key: 'emCnt1y' },
    { label: '2년 이상', key: 'emCnt2y' },
    { label: '4년 이상', key: 'emCnt4y' },
    { label: '6년 이상', key: 'emCnt6y' },
  ] as const
  return defs
    .map(({ label, key }, i) => ({ label, cnt: d[key] as number | undefined, colorClass: CAREER_COLORS[i] }))
    .filter(item => item.cnt != null && item.cnt > 0)
})

const hasCareerData = computed(() => careerItems.value.length > 0)
</script>
