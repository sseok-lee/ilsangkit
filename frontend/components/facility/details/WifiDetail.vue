<template>
  <div class="space-y-4">
    <!-- 기본 정보 -->
    <div class="space-y-3">
      <DetailRow v-if="details.ssid" label="SSID" :value="details.ssid" />
      <DetailRow
        v-if="details.installDate"
        label="설치연월"
        :value="formattedInstallDate"
      />
      <DetailRow
        v-if="details.serviceProvider"
        label="서비스 제공사"
        :value="details.serviceProvider"
      />
      <DetailRow
        v-if="details.installLocation"
        label="설치장소"
        :value="details.installLocation"
      />
      <DetailRow
        v-if="details.installLocationDetail"
        label="설치장소 상세"
        :value="details.installLocationDetail"
      />
      <DetailRow
        v-if="details.managementAgency"
        label="관리기관"
        :value="details.managementAgency"
      />
      <DetailRow
        v-if="details.phoneNumber"
        label="연락처"
        :value="details.phoneNumber"
      />
    </div>

    <!-- 접속 방법 안내 -->
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h4 class="font-semibold text-blue-900 text-sm mb-2 flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[18px]">wifi</span>
        접속 방법
      </h4>
      <p class="text-sm text-blue-800 leading-relaxed">
        스마트폰 와이파이 설정에서
        <template v-if="details.ssid">"<strong>{{ details.ssid }}</strong>"</template>
        <template v-else>해당 SSID</template>를
        선택하면 별도 비밀번호 없이 무료로 접속할 수 있습니다.
        공공 와이파이 이용 시 개인정보 입력이나 금융 거래는 피하는 것이 안전합니다.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WifiDetails } from '~/types/facility'

const props = defineProps<{
  details: WifiDetails
}>()

// 설치연월을 사용자 친화적으로 변환 (예: "202301" → "2023년 1월")
const formattedInstallDate = computed(() => {
  const raw = props.details.installDate
  if (!raw) return ''
  const match = raw.match(/^(\d{4})[-.]?(\d{2})/)
  if (match) {
    const year = match[1]
    const month = parseInt(match[2], 10)
    return `${year}년 ${month}월`
  }
  return raw
})
</script>
