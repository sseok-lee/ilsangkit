<template>
  <div class="space-y-3">
    <!-- 뱃지 영역: schoolLevel + foundationType + 남녀공학 + 분교 + operationStatus -->
    <div class="flex items-center gap-2 flex-wrap">
      <span
        v-if="details.schoolLevel"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="schoolLevelBadgeClass"
      >
        {{ details.schoolLevel }}
      </span>
      <span
        v-if="details.foundationType"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="foundationTypeBadgeClass"
      >
        {{ details.foundationType }}
      </span>
      <span
        v-if="details.coeducationType"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-indigo-100 text-indigo-800"
      >
        {{ details.coeducationType }}
      </span>
      <span
        v-if="details.highSchoolType"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-violet-100 text-violet-800"
      >
        {{ details.highSchoolType }}
      </span>
      <span
        v-if="isBranch"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-orange-100 text-orange-800"
      >
        분교
      </span>
      <span
        v-if="details.operationStatus"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="operationStatusBadgeClass"
      >
        {{ details.operationStatus }}
      </span>
    </div>

    <!-- 기본 정보 -->
    <div class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">기본 정보</p>
      <div class="flex flex-col gap-2">
        <div v-if="details.foundedDate" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">설립일</span>
          <span class="text-sm font-medium text-gray-900">{{ details.foundedDate }}</span>
        </div>
        <div v-if="details.phoneNumber" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">연락처</span>
          <a :href="`tel:${details.phoneNumber}`" class="text-sm font-medium text-blue-600 hover:underline">{{ details.phoneNumber }}</a>
        </div>
        <div v-if="details.faxNumber" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">팩스</span>
          <span class="text-sm font-medium text-gray-900">{{ details.faxNumber }}</span>
        </div>
        <div v-if="details.dayNightType" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">주야구분</span>
          <span class="text-sm font-medium text-gray-900">{{ details.dayNightType }}</span>
        </div>
        <div v-if="details.branchType && !isBranch" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">본교/분교</span>
          <span class="text-sm font-medium text-gray-900">{{ details.branchType }}</span>
        </div>
      </div>
    </div>

    <!-- 홈페이지 -->
    <div v-if="details.homepageUrl" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-1">홈페이지</p>
      <a
        :href="normalizedHomepageUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-blue-600 hover:underline break-all"
      >
        {{ details.homepageUrl }}
      </a>
    </div>

    <!-- 관할 교육청 -->
    <div v-if="details.sidoEduName || details.localEduName" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">관할 교육청</p>
      <div class="flex flex-col gap-2">
        <div v-if="details.sidoEduName" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">시도교육청</span>
          <span class="text-sm font-medium text-gray-900">{{ details.sidoEduName }}</span>
        </div>
        <div v-if="details.localEduName" class="flex items-center justify-between">
          <span class="text-sm text-gray-600">교육지원청</span>
          <span class="text-sm font-medium text-gray-900">{{ details.localEduName }}</span>
        </div>
      </div>
    </div>

    <!-- 학급 현황 -->
    <div v-if="hasEnrollmentData" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">학급 현황</p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="py-1.5 pr-3 text-left text-gray-500 font-medium">학년</th>
              <th class="py-1.5 pl-2 text-right text-gray-500 font-medium">반 수</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in enrollmentRows" :key="row.label" :class="row.isTotal ? 'bg-gray-50 font-semibold' : ''">
              <td class="py-1.5 pr-3 font-medium text-gray-700">{{ row.label }}</td>
              <td class="py-1.5 pl-2 text-right text-gray-600">{{ row.classCount != null ? row.classCount + '개' : '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 학과 정보 (특성화고) -->
    <div v-if="hasDepartments" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-bold text-gray-900 mb-2">학과 정보</p>
      <div class="flex flex-wrap gap-2">
        <span
          v-for="dept in details.departments"
          :key="dept.departmentName"
          class="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-sky-100 text-sky-800"
        >
          {{ dept.departmentName }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SchoolDetails } from '~/types/facility'

const props = defineProps<{
  details: SchoolDetails
}>()

const schoolLevelBadgeClass = computed(() => {
  const level = props.details.schoolLevel || ''
  if (level.includes('초등')) return 'bg-green-100 text-green-800'
  if (level.includes('중학')) return 'bg-blue-100 text-blue-800'
  if (level.includes('고등')) return 'bg-purple-100 text-purple-800'
  if (level.includes('특수')) return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-800'
})

const foundationTypeBadgeClass = computed(() => {
  const type = props.details.foundationType || ''
  if (type.includes('국립')) return 'bg-red-100 text-red-800'
  if (type.includes('공립')) return 'bg-blue-100 text-blue-800'
  if (type.includes('사립')) return 'bg-purple-100 text-purple-800'
  return 'bg-gray-100 text-gray-800'
})

const isBranch = computed(() => {
  return props.details.branchType?.includes('분교') ?? false
})

const operationStatusBadgeClass = computed(() => {
  const status = props.details.operationStatus || ''
  if (status.includes('운영')) return 'bg-green-100 text-green-800'
  if (status.includes('폐교') || status.includes('폐쇄')) return 'bg-red-100 text-red-800'
  return 'bg-gray-100 text-gray-800'
})

const normalizedHomepageUrl = computed(() => {
  const url = props.details.homepageUrl || ''
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `http://${url}`
})

// 학생 현황 테이블
const hasEnrollmentData = computed(() => {
  return props.details.enrollments && props.details.enrollments.length > 0
})

const enrollmentRows = computed(() => {
  const enrollments = props.details.enrollments || []
  const sorted = [...enrollments].sort((a, b) => a.grade - b.grade)

  const rows = sorted.map(e => ({
    label: `${e.grade}학년`,
    classCount: e.classCount,
    isTotal: false,
  }))

  // 합계 행 추가
  if (rows.length > 1) {
    let totalClasses = 0
    for (const e of enrollments) {
      totalClasses += e.classCount || 0
    }
    rows.push({ label: '합계', classCount: totalClasses, isTotal: true })
  }

  return rows
})

// 학과 정보
const hasDepartments = computed(() => {
  return props.details.departments && props.details.departments.length > 0
})
</script>
