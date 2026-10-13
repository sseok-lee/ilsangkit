<template>
  <div />
</template>

<script setup lang="ts">
import { useWasteAreas } from '~/composables/useWasteAreas'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { wasteAreaRedirectTarget } from '~/utils/wasteAreaRedirect'

const route = useRoute()

function markRedirectNoStore() {
  if (!import.meta.server) return
  if (useRequestEvent()) useResponseHeader('cache-control').value = 'no-store'
}

markRedirectNoStore()

const rawAreaId = String(route.params.areaId ?? '')
if (!/^[1-9]\d*$/.test(rawAreaId)) {
  throw createError({ statusCode: 400, statusMessage: '잘못된 동별 배출 안내 주소입니다' })
}

const areaId = Number.parseInt(rawAreaId, 10)
const wasteAreas = useWasteAreas()

const { data: areaDetail, error } = await useAsyncData(
  `trash-area-redirect-${areaId}`,
  () => wasteAreas.detail(areaId),
)

if (error.value) {
  const status = error.value.statusCode || error.value.status || error.value.response?.status
  if (status === 410) throw createError({ statusCode: 410, statusMessage: '종료된 동별 배출 안내입니다' })
  if (status === 404) throw createError({ statusCode: 404, statusMessage: '동별 배출 안내를 찾을 수 없습니다' })
  if (status === 400) throw createError({ statusCode: 400, statusMessage: '잘못된 동별 배출 안내 주소입니다' })
  if (import.meta.server) markDegradedResponse()
  throw createError({ statusCode: 503, statusMessage: '동별 배출 안내를 불러오지 못했습니다' })
}

if (!areaDetail.value) {
  if (import.meta.server) markDegradedResponse()
  throw createError({ statusCode: 503, statusMessage: '동별 배출 안내를 불러오지 못했습니다' })
}

let target: string
try {
  target = wasteAreaRedirectTarget(areaDetail.value)
} catch {
  throw createError({ statusCode: 400, statusMessage: '잘못된 동별 배출 안내 주소입니다' })
}

await navigateTo(target, { redirectCode: 302, replace: true })
</script>
