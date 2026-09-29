<template>
  <a
    :href="area.href"
    class="block border-b border-[#E6E9F0] bg-white px-1 py-4 transition-colors hover:bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#2450DC]/20"
    @click="openArea"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div class="min-w-0">
        <p class="text-base font-bold leading-6 text-[#15213B]">{{ area.name }}</p>
        <p class="mt-1 text-sm text-[#56627A]">{{ area.city }} {{ area.district }}</p>
        <p class="mt-2 text-sm leading-6 text-[#15213B]">{{ coverageText }}</p>
        <p class="mt-1 text-sm leading-6 text-[#56627A]">{{ area.summary }}</p>
      </div>
      <div class="flex shrink-0 flex-row flex-wrap items-center gap-2 sm:justify-end">
        <span class="rounded bg-[#F1F4F8] px-2.5 py-1 text-sm font-semibold text-[#56627A]">
          {{ countText }}
        </span>
        <span v-if="dateText" class="text-sm text-[#56627A]">{{ dateText }}</span>
      </div>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AreaSummary } from '~/types/wasteArea'
import { storeTrashReturnStateForTarget, trashReturnStateFromRoute } from '~/utils/trashReturnContext'

const props = defineProps<{ area: AreaSummary }>()
const route = useRoute()

const coverageText = computed(() => {
  if (props.area.conditionalCount > 0) return `적용 대상 · 조건별 일정 ${props.area.conditionalCount.toLocaleString('ko-KR')}건`
  return `적용 대상 · 확인 일정 ${props.area.scheduleCount.toLocaleString('ko-KR')}건`
})

const countText = computed(() => {
  const schedule = `${props.area.scheduleCount.toLocaleString('ko-KR')}건`
  if (props.area.conditionalCount <= 0) return schedule
  return `${schedule} · 조건 ${props.area.conditionalCount.toLocaleString('ko-KR')}`
})

const dateText = computed(() => {
  if (!props.area.dataDate) return ''
  const [date] = props.area.dataDate.split('T')
  return `기준일 ${date}`
})

function openArea(event: MouseEvent) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  const state = trashReturnStateFromRoute(route, '목록으로 돌아가기', null)
  storeTrashReturnStateForTarget(props.area.href, state)
  const router = typeof useNuxtApp === 'function' ? useNuxtApp().$router : null
  if (import.meta.client && router?.push) {
    router.push({ path: props.area.href, state })
  } else {
    navigateTo({ path: props.area.href, state })
  }
}
</script>
