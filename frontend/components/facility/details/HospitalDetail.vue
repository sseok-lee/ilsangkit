<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.clCdNm"
      label="종별"
      :value="details.clCdNm"
    />
    <DetailRow
      v-if="details.phone"
      label="전화번호"
      :value="details.phone"
      type="phone"
    />
    <DetailRow
      v-if="details.estbDd"
      label="개설일자"
      :value="details.estbDd"
    />

    <div v-if="details.homepage" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-1">홈페이지</p>
      <a
        :href="details.homepage"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-blue-600 hover:underline break-all"
      >
        {{ details.homepage }}
      </a>
    </div>

    <!-- 진료과목 -->
    <div v-if="details.departments && details.departments.length > 0" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">진료과목</p>
      <div class="flex flex-wrap gap-1.5">
        <span
          v-for="dept in details.departments"
          :key="dept.dgsbjtCdNm"
          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200"
        >
          {{ dept.dgsbjtCdNm }}
          <span v-if="dept.dgsbjtPrSdrCnt" class="ml-1 text-teal-500">({{ dept.dgsbjtPrSdrCnt }}명)</span>
        </span>
      </div>
    </div>

    <!-- 진료시간 -->
    <div v-if="hasSchedule" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">진료시간</p>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="py-1.5 pr-3 text-left text-gray-500 font-medium">요일</th>
              <th class="py-1.5 text-left text-gray-500 font-medium">진료시간</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            <tr v-for="row in scheduleRows" :key="row.day" :class="{ 'text-gray-400': row.closed }">
              <td class="py-1.5 pr-3 font-medium" :class="row.day === '일' ? 'text-red-500' : row.day === '토' ? 'text-blue-500' : 'text-gray-700'">{{ row.day }}</td>
              <td class="py-1.5 text-gray-600">{{ row.time }}</td>
            </tr>
            <tr v-if="details.lunchWeek">
              <td class="py-1.5 pr-3 font-medium text-gray-700">점심(평일)</td>
              <td class="py-1.5 text-gray-600">{{ details.lunchWeek }}</td>
            </tr>
            <tr v-if="details.lunchSat">
              <td class="py-1.5 pr-3 font-medium text-blue-500">점심(토)</td>
              <td class="py-1.5 text-gray-600">{{ details.lunchSat }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="details.noTrmtSun" class="mt-2 text-xs text-gray-500">
        <span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}
      </div>
      <div v-if="details.noTrmtHoli" class="mt-1 text-xs text-gray-500">
        <span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}
      </div>
    </div>

    <!-- 주차정보 -->
    <div v-if="details.parkQty != null || details.parkEtc" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">주차정보</p>
      <div class="space-y-1">
        <div v-if="details.parkQty != null" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">주차가능대수</span>
          <span class="text-gray-700 font-medium">{{ details.parkQty }}대</span>
        </div>
        <p v-if="details.parkEtc" class="text-sm text-gray-600">{{ details.parkEtc }}</p>
      </div>
    </div>

    <!-- 의료진 현황 -->
    <div v-if="details.drTotCnt" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">의료진 현황</p>
      <div class="space-y-1">
        <div class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의사 총수</span>
          <span class="text-gray-700 font-medium">{{ details.drTotCnt }}명</span>
        </div>
        <div v-if="details.mdeptSdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의과 전문의</span>
          <span class="text-gray-700">{{ details.mdeptSdrCnt }}명</span>
        </div>
        <div v-if="details.mdeptGdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의과 일반의</span>
          <span class="text-gray-700">{{ details.mdeptGdrCnt }}명</span>
        </div>
        <div v-if="details.mdeptIntnCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의과 인턴</span>
          <span class="text-gray-700">{{ details.mdeptIntnCnt }}명</span>
        </div>
        <div v-if="details.mdeptResdntCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">의과 레지던트</span>
          <span class="text-gray-700">{{ details.mdeptResdntCnt }}명</span>
        </div>
        <div v-if="details.detySdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">치과 전문의</span>
          <span class="text-gray-700">{{ details.detySdrCnt }}명</span>
        </div>
        <div v-if="details.detyGdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">치과 일반의</span>
          <span class="text-gray-700">{{ details.detyGdrCnt }}명</span>
        </div>
        <div v-if="details.detyIntnCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">치과 인턴</span>
          <span class="text-gray-700">{{ details.detyIntnCnt }}명</span>
        </div>
        <div v-if="details.detyResdntCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">치과 레지던트</span>
          <span class="text-gray-700">{{ details.detyResdntCnt }}명</span>
        </div>
        <div v-if="details.cmdcSdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">한방 전문의</span>
          <span class="text-gray-700">{{ details.cmdcSdrCnt }}명</span>
        </div>
        <div v-if="details.cmdcGdrCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">한방 일반의</span>
          <span class="text-gray-700">{{ details.cmdcGdrCnt }}명</span>
        </div>
        <div v-if="details.cmdcIntnCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">한방 인턴</span>
          <span class="text-gray-700">{{ details.cmdcIntnCnt }}명</span>
        </div>
        <div v-if="details.cmdcResdntCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">한방 레지던트</span>
          <span class="text-gray-700">{{ details.cmdcResdntCnt }}명</span>
        </div>
        <div v-if="details.pnursCnt" class="flex items-center justify-between text-sm">
          <span class="text-gray-600">간호사</span>
          <span class="text-gray-700">{{ details.pnursCnt }}명</span>
        </div>
      </div>
    </div>

    <!-- 데이터 기준일 -->
    <div v-if="details.dataDate" class="pt-3 border-t border-gray-200">
      <p class="text-xs text-gray-400">데이터 기준일: {{ details.dataDate }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { HospitalDetails } from '~/types/facility'

const props = defineProps<{
  details: HospitalDetails
}>()

function formatTime(start?: string | null, end?: string | null): string | null {
  if (!start && !end) return null
  const fmt = (t: string) => {
    const s = t.replace(':', '')
    if (s.length === 4) return `${s.slice(0, 2)}:${s.slice(2)}`
    return t
  }
  if (start && end) return `${fmt(start)} ~ ${fmt(end)}`
  if (start) return `${fmt(start)} ~`
  return null
}

const scheduleRows = computed(() => {
  const d = props.details
  const days = [
    { day: '월', start: d.trmtMonStart, end: d.trmtMonEnd },
    { day: '화', start: d.trmtTueStart, end: d.trmtTueEnd },
    { day: '수', start: d.trmtWedStart, end: d.trmtWedEnd },
    { day: '목', start: d.trmtThuStart, end: d.trmtThuEnd },
    { day: '금', start: d.trmtFriStart, end: d.trmtFriEnd },
    { day: '토', start: d.trmtSatStart, end: d.trmtSatEnd },
    { day: '일', start: d.trmtSunStart, end: d.trmtSunEnd },
  ]
  return days.map(({ day, start, end }) => {
    const time = formatTime(start, end)
    const isSun = day === '일'
    const closed = !time
    return { day, time: closed ? '휴진' : time, closed }
  })
})

const hasSchedule = computed(() => {
  const d = props.details
  return d.trmtMonStart || d.trmtTueStart || d.trmtWedStart ||
    d.trmtThuStart || d.trmtFriStart || d.trmtSatStart || d.trmtSunStart
})
</script>
