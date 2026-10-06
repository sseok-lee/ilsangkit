<template>
  <div class="bg-white text-ink min-h-screen">
  <div class="page-container pb-10">
    <PageHead eyebrow="동별 쓰레기 배출 안내" :title="heroTitle" :description="heroDescription">
      <template #breadcrumb>
        <Breadcrumb :items="breadcrumbItems" class="mb-4" />
      </template>
    </PageHead>

    <div v-if="returnContext" class="mt-6 flex flex-wrap gap-2">
      <UiButton variant="secondary" :href="returnContext.href" @click="returnToContext">{{ returnContext.label }}</UiButton>
    </div>

    <SectionBlock variant="flat" heading="적용 대상" :subtext="areaSubtext">
      <dl class="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="font-semibold text-muted">지역</dt>
          <dd class="mt-1 font-bold text-ink">{{ detail.area.city }} {{ detail.area.district }} {{ detail.area.name }}</dd>
        </div>
        <div>
          <dt class="font-semibold text-muted">확인 일정</dt>
          <dd class="mt-1 text-ink">{{ detail.area.scheduleCount.toLocaleString('ko-KR') }}건</dd>
        </div>
        <div v-if="detail.area.conditionalCount > 0">
          <dt class="font-semibold text-muted">조건별 일정</dt>
          <dd class="mt-1 text-ink">{{ detail.area.conditionalCount.toLocaleString('ko-KR') }}건</dd>
        </div>
        <div v-if="detail.contentUpdatedAt || detail.area.dataDate">
          <dt class="font-semibold text-muted">자료 기준일</dt>
          <dd class="mt-1 text-ink">{{ formattedDate }}</dd>
        </div>
      </dl>
      <p v-if="detail.area.summary" class="mt-3 break-words text-sm leading-6 text-muted">{{ detail.area.summary }}</p>
    </SectionBlock>

    <SectionBlock
      variant="flat"
      heading="배출 일정"
      :subtext="detail.schedules.length > 0 ? '적용 조건을 먼저 확인한 뒤 배출 요일과 시간을 확인하세요.' : '현재 이 동에 연결된 배출 일정이 없습니다.'"
    >
      <div v-if="detail.schedules.length > 0" class="space-y-3">
        <WasteScheduleContent
          v-for="item in detail.schedules"
          :key="scheduleKey(item)"
          :schedule="item.schedule"
          :scope="item.scope"
          :condition-text="item.conditionText"
        />
      </div>
      <div v-else class="rounded-[10px] bg-background-light p-6 text-center">
        <p class="font-semibold text-ink">확인된 배출 일정이 없습니다</p>
        <p class="mt-1 text-sm text-muted">구·군 원문 목록에서 아직 연결이 필요한 자료를 확인할 수 있습니다.</p>
      </div>
    </SectionBlock>

    <SectionBlock
      v-if="detail.predecessorOrSuccessorLinks.length > 0 || detail.unresolved.href"
      variant="flat"
      heading="관련 안내"
    >
      <div class="flex flex-wrap gap-2">
        <UiButton v-for="link in detail.predecessorOrSuccessorLinks" :key="link.href" variant="secondary" :to="link.href">{{ link.name }}</UiButton>
        <UiButton v-if="detail.unresolved.href" variant="secondary" :to="detail.unresolved.href">연결 확인이 필요한 원문 {{ detail.unresolved.count.toLocaleString('ko-KR') }}건</UiButton>
      </div>
    </SectionBlock>

    <DataSourceSection domain="facility" category="trash" variant="flat" :last-sync-date="formattedDate" />
  </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useWasteAreas } from '~/composables/useWasteAreas'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHead from '~/components/common/PageHead.vue'
import UiButton from '~/components/common/UiButton.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import WasteScheduleContent from '~/components/trash/WasteScheduleContent.vue'
import type { WasteAreaSchedule } from '~/types/wasteArea'
import { buildWasteAreaHead } from '~/utils/wasteAreaSeo'
import { readTrashReturnContext, sanitizeTrustedTrashReturn, type TrashReturnContext } from '~/utils/trashReturnContext'

const route = useRoute()
const rawAreaId = String(route.params.areaId ?? '')
if (!/^[1-9]\d*$/.test(rawAreaId)) {
  throw createError({ statusCode: 400, statusMessage: '잘못된 동별 배출 안내 주소입니다' })
}

const areaId = Number.parseInt(rawAreaId, 10)
const wasteAreas = useWasteAreas()

const { data: areaDetail, error } = await useAsyncData(
  `trash-area-${areaId}`,
  () => wasteAreas.detail(areaId)
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

const detail = computed(() => areaDetail.value!)
const returnContext = ref<TrashReturnContext | null>(null)
const heroTitle = computed(() => `${detail.value.area.city} ${detail.value.area.district} ${detail.value.area.name}`)
const heroDescription = computed(() => '이 동에 실제로 적용되는 쓰레기 배출 조건과 원본 출처를 함께 확인하세요.')
const areaSubtext = computed(() =>
  detail.value.area.conditionalCount > 0
    ? `조건별 일정 ${detail.value.area.conditionalCount.toLocaleString('ko-KR')}건이 포함되어 있습니다.`
    : '동별로 확인된 배출 일정입니다.'
)
const formattedDate = computed(() => {
  const value = detail.value.area.dataDate
  return value ? String(value).split('T')[0] : null
})

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '쓰레기 배출', href: '/trash', current: false },
  { label: detail.value.area.name, href: `/trash/areas/${detail.value.area.areaId}`, current: true },
])

useHead(computed(() => buildWasteAreaHead({
  areaId,
  title: heroTitle.value,
  description: `${heroTitle.value}의 쓰레기 배출 요일, 시간, 조건, 원본 출처를 확인하세요.`,
  indexEligible: detail.value.indexEligible,
  hasSchedules: detail.value.schedules.length > 0,
  hasQuery: Object.keys(route.query).length > 0,
  sourceState: detail.value.schedules.length > 0 ? 'ok' : 'empty',
})))

function restoreReturnScroll(context: TrashReturnContext) {
  if (!import.meta.client || typeof context.scrollY !== 'number' || !Number.isFinite(context.scrollY)) return
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: context.scrollY })
    })
  })
}

function matchingSafeBackHref(context: TrashReturnContext): boolean {
  if (!import.meta.client) return false
  const rawBack = window.history.state && typeof window.history.state === 'object'
    ? (window.history.state as { back?: unknown }).back
    : undefined
  return typeof rawBack === 'string' && sanitizeTrustedTrashReturn(rawBack) === context.href
}

async function returnToContext(event: MouseEvent) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  const context = returnContext.value
  if (!context) return
  event.preventDefault()

  if (!import.meta.client) {
    await navigateTo(context.href)
    return
  }

  const router = typeof useNuxtApp === 'function' ? useNuxtApp().$router : null
  if (!router?.afterEach || !router?.push || !router?.back) {
    await navigateTo(context.href)
    restoreReturnScroll(context)
    return
  }

  if (matchingSafeBackHref(context) && window.history.length > 1) {
    let removed = false
    const remove = router.afterEach(() => {
      if (removed) return
      removed = true
      remove()
      restoreReturnScroll(context)
    })
    router.back()
    window.setTimeout(() => {
      if (removed) return
      removed = true
      remove()
    }, 1500)
    return
  }

  await router.push(context.href)
  restoreReturnScroll(context)
}

onMounted(() => {
  returnContext.value = readTrashReturnContext(null)
})

function scheduleKey(item: WasteAreaSchedule): string {
  return `${item.schedule.id}:${item.scope}:${item.conditionText}`
}
</script>
