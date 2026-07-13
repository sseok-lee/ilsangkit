<template>
  <span v-if="displayAddress" class="inline-flex items-center gap-1.5 flex-wrap">
    <span class="material-symbols-outlined text-[18px] text-faint shrink-0" aria-hidden="true">location_on</span>
    <span>{{ displayAddress }}</span>
    <button
      type="button"
      data-test="address-copy"
      class="inline-flex items-center gap-0.5 shrink-0 text-primary hover:underline focus:outline-none focus-visible:underline"
      :aria-label="copied ? '주소가 복사되었습니다' : '주소 복사'"
      @click="copy"
    >
      <span class="material-symbols-outlined text-[16px]">{{ copied ? 'check' : 'content_copy' }}</span>
      <span class="text-xs font-medium">{{ copied ? '복사됨' : '복사' }}</span>
    </button>
    <!-- 스크린리더용 라이브 피드백 -->
    <span class="sr-only" role="status" aria-live="polite">{{ copied ? '주소가 복사되었습니다' : '' }}</span>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  /** 표시·복사할 주소. 없거나 '-'(플레이스홀더)면 아무것도 렌더하지 않는다. */
  address?: string | null
}>()

const displayAddress = computed(() => (props.address && props.address !== '-' ? props.address : ''))

const copied = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | null = null

async function copy() {
  // @click 핸들러라 client에서만 실행됨(SSR 미호출). clipboard 미지원은 try/catch로 흡수.
  if (!displayAddress.value) return
  try {
    await navigator.clipboard.writeText(displayAddress.value)
    copied.value = true
    if (resetTimer) clearTimeout(resetTimer)
    resetTimer = setTimeout(() => {
      copied.value = false
    }, 1500)
  }
  catch {
    // clipboard 미지원(비보안 컨텍스트 등) — 조용히 무시
  }
}
</script>
