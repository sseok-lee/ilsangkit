<template>
  <div class="space-y-3">
    <!-- 뱃지 영역: schoolLevel + foundationType + 분교 + operationStatus -->
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

    <!-- 기본 정보 2열 그리드 -->
    <div class="grid grid-cols-2 gap-x-4 gap-y-1">
      <DetailRow
        v-if="details.foundedDate"
        label="설립일"
        :value="details.foundedDate"
      />
      <DetailRow
        v-if="details.branchType"
        label="본교/분교"
        :value="details.branchType"
      />
    </div>

    <div v-if="details.sidoEduName || details.localEduName" class="pt-3 border-t border-gray-200">
      <p class="text-xs font-medium text-gray-500 mb-2">관할 교육청</p>
      <div class="space-y-2">
        <div v-if="details.sidoEduName" class="flex flex-row py-1 gap-4">
          <dt class="text-xs font-medium text-gray-500 min-w-[7rem] shrink-0 pt-0.5">시도교육청</dt>
          <dd class="text-sm text-gray-900">{{ details.sidoEduName }}</dd>
        </div>
        <div v-if="details.localEduName" class="flex flex-row py-1 gap-4">
          <dt class="text-xs font-medium text-gray-500 min-w-[7rem] shrink-0 pt-0.5">교육지원청</dt>
          <dd class="text-sm text-gray-900">{{ details.localEduName }}</dd>
        </div>
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
</script>
