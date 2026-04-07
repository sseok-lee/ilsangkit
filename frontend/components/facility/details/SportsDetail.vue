<template>
  <div class="space-y-3">
    <!-- 뱃지 영역: ftypeNm + faciGbNm + nationYn -->
    <div class="flex items-center gap-2 flex-wrap">
      <span
        v-if="details.ftypeNm"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="ftypeNmBadgeClass"
      >
        {{ details.ftypeNm }}
      </span>
      <span
        v-if="details.faciGbNm"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium"
        :class="faciGbNmBadgeClass"
      >
        {{ details.faciGbNm }}
      </span>
      <span
        v-if="details.nationYn === 'Y'"
        class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium bg-red-100 text-red-800"
      >
        국가대표시설
      </span>
    </div>

    <DetailRow
      v-if="details.fcobNm"
      label="업종명"
      :value="details.fcobNm"
    />
    <DetailRow
      v-if="details.faciGfa"
      label="시설면적"
      :value="`${details.faciGfa}㎡`"
    />
    <DetailRow
      v-if="details.standCptPsnCnt !== undefined && details.standCptPsnCnt !== null"
      label="관람석수"
      :value="`${details.standCptPsnCnt.toLocaleString()}석`"
    />
    <DetailRow
      v-if="details.fmngTypeGbNm"
      label="관리유형"
      :value="details.fmngTypeGbNm"
    />

    <!-- 홈페이지 -->
    <div v-if="details.faciHomepage" class="flex flex-row py-2 border-b border-slate-100 last:border-0 gap-4">
      <dt class="text-xs font-medium text-slate-500 min-w-[7rem] shrink-0 pt-0.5">홈페이지</dt>
      <dd class="text-sm text-slate-900">
        <a
          :href="details.faciHomepage"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary font-medium underline"
        >
          {{ details.faciHomepage }}
        </a>
      </dd>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SportsDetails } from '~/types/facility'

const props = defineProps<{
  details: SportsDetails
}>()

const ftypeNmBadgeClass = computed(() => {
  const type = props.details.ftypeNm || ''
  if (type.includes('축구')) return 'bg-green-100 text-green-800'
  if (type.includes('농구')) return 'bg-orange-100 text-orange-800'
  if (type.includes('수영')) return 'bg-blue-100 text-blue-800'
  if (type.includes('체육관')) return 'bg-purple-100 text-purple-800'
  return 'bg-slate-100 text-slate-800'
})

const faciGbNmBadgeClass = computed(() => {
  const gb = props.details.faciGbNm || ''
  if (gb.includes('공공')) return 'bg-blue-100 text-blue-800'
  if (gb.includes('민간')) return 'bg-orange-100 text-orange-800'
  return 'bg-slate-100 text-slate-800'
})
</script>
