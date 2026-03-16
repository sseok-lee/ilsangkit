<template>
  <div class="space-y-3">
    <!-- 공원 유형 뱃지 -->
    <div v-if="details.parkType" class="flex items-center gap-2">
      <span
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="parkTypeBadgeClass"
      >
        {{ details.parkType }}
      </span>
    </div>

    <DetailRow
      v-if="details.area !== undefined && details.area !== null"
      label="면적"
      :value="areaFormatted"
    />
    <DetailRow
      v-if="details.designatedDate"
      label="지정일"
      :value="details.designatedDate"
    />
    <DetailRow
      v-if="details.managingOrg"
      label="관리기관"
      :value="details.managingOrg"
    />
    <DetailRow
      v-if="details.phoneNumber"
      label="연락처"
      :value="details.phoneNumber"
      type="phone"
    />

    <template v-if="hasFacilities">
      <div v-if="exerciseTags.length" class="pt-3 border-t border-gray-200">
        <p class="text-sm font-bold text-gray-900 mb-2">운동시설</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="tag in exerciseTags" :key="'e-'+tag" class="inline-block rounded-full px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200">{{ tag }}</span>
        </div>
      </div>
      <div v-if="playTags.length" class="pt-3 border-t border-gray-200">
        <p class="text-sm font-bold text-gray-900 mb-2">놀이시설</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="tag in playTags" :key="'p-'+tag" class="inline-block rounded-full px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200">{{ tag }}</span>
        </div>
      </div>
      <div v-if="convenienceTags.length" class="pt-3 border-t border-gray-200">
        <p class="text-sm font-bold text-gray-900 mb-2">편의시설</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="tag in convenienceTags" :key="'c-'+tag" class="inline-block rounded-full px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200">{{ tag }}</span>
        </div>
      </div>
      <div v-if="cultureTags.length" class="pt-3 border-t border-gray-200">
        <p class="text-sm font-bold text-gray-900 mb-2">교양시설</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="tag in cultureTags" :key="'cu-'+tag" class="inline-block rounded-full px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200">{{ tag }}</span>
        </div>
      </div>
      <div v-if="otherTags.length" class="pt-3 border-t border-gray-200">
        <p class="text-sm font-bold text-gray-900 mb-2">기타시설</p>
        <div class="flex flex-wrap gap-1.5">
          <span v-for="tag in otherTags" :key="'o-'+tag" class="inline-block rounded-full px-3 py-1 text-xs font-medium text-gray-700 border border-gray-200">{{ tag }}</span>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ParkDetails } from '~/types/facility'

const props = defineProps<{
  details: ParkDetails
}>()

const parkTypeBadgeClass = computed(() => {
  const type = props.details.parkType || ''
  if (type.includes('어린이')) return 'bg-green-100 text-green-800'
  if (type.includes('근린')) return 'bg-blue-100 text-blue-800'
  if (type.includes('문화')) return 'bg-purple-100 text-purple-800'
  if (type.includes('체육')) return 'bg-orange-100 text-orange-800'
  if (type.includes('수변')) return 'bg-cyan-100 text-cyan-800'
  if (type.includes('역사')) return 'bg-amber-100 text-amber-800'
  if (type.includes('소공원')) return 'bg-gray-100 text-gray-800'
  return 'bg-gray-100 text-gray-800'
})

const areaFormatted = computed(() => {
  const area = props.details.area
  if (area === undefined || area === null) return ''
  const pyeong = Math.round(area * 0.3025)
  return `${area.toLocaleString()}㎡ (약 ${pyeong.toLocaleString()}평)`
})

const splitTags = (value: string | undefined | null) =>
  value?.split('+').map(s => s.trim()).filter(Boolean) ?? []

const exerciseTags = computed(() => splitTags(props.details.exerciseFacilities))
const playTags = computed(() => splitTags(props.details.playFacilities))
const convenienceTags = computed(() => splitTags(props.details.convenienceFacilities))
const cultureTags = computed(() => splitTags(props.details.cultureFacilities))
const otherTags = computed(() => splitTags(props.details.otherFacilities))

const hasFacilities = computed(() => {
  return (
    exerciseTags.value.length > 0 ||
    playTags.value.length > 0 ||
    convenienceTags.value.length > 0 ||
    cultureTags.value.length > 0 ||
    otherTags.value.length > 0
  )
})
</script>
