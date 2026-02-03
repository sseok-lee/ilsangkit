<template>
  <div class="space-y-3">
    <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <p class="text-sm text-yellow-800">
        <strong>안내:</strong> 쓰레기 배출 정보는 WasteSchedule 데이터에서 제공됩니다.
        현재 상세 페이지에서는 표시되지 않습니다.
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
// TrashDetail은 실제로 WasteSchedule 테이블에서 관리되므로
// 여기서는 placeholder만 표시
defineProps<{
  details: Record<string, any>
}>()
</script>
