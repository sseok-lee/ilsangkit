<template>
  <article class="rounded-[10px] border border-line bg-white p-4">
    <header class="border-b border-line pb-3">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-semibold text-primary">{{ scopeText }}</p>
          <h3 class="mt-1 text-lg font-bold leading-7 text-ink">
            {{ targetText }}
          </h3>
          <p class="mt-1 break-words text-sm leading-6 text-muted">
            {{ conditionText || '해당 동 전체에 적용되는 배출 안내입니다.' }}
          </p>
        </div>
        <UiButton variant="secondary" :href="sourceHref" class="shrink-0" @click="openSource">원문 보기</UiButton>
      </div>
    </header>

    <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
      <div v-if="schedule.emissionPlace" class="min-w-0">
        <dt class="font-semibold text-muted">배출 장소</dt>
        <dd class="mt-1 break-words text-ink">{{ schedule.emissionPlace }}</dd>
      </div>
      <div v-if="details?.emissionPlaceType" class="min-w-0">
        <dt class="font-semibold text-muted">수거 방식</dt>
        <dd class="mt-1 break-words text-ink">{{ details.emissionPlaceType }}</dd>
      </div>
      <div v-if="details?.managementZone" class="min-w-0">
        <dt class="font-semibold text-muted">관리구역</dt>
        <dd class="mt-1 break-words text-ink">{{ details.managementZone }}</dd>
      </div>
      <div v-if="details?.uncollectedDay" class="min-w-0">
        <dt class="font-semibold text-muted">미수거일</dt>
        <dd class="mt-1 break-words text-ink">{{ details.uncollectedDay }}</dd>
      </div>
    </dl>

    <div class="mt-4 grid gap-3 md:grid-cols-2">
      <WasteTypeSection
        v-if="details?.livingWaste"
        icon="delete"
        icon-color="amber"
        title="일반쓰레기"
        :info="details.livingWaste"
      />
      <WasteTypeSection
        v-if="details?.foodWaste"
        icon="restaurant"
        icon-color="green"
        title="음식물쓰레기"
        :info="details.foodWaste"
      />
      <WasteTypeSection
        v-if="details?.recyclable"
        icon="recycling"
        icon-color="teal"
        title="재활용"
        :info="details.recyclable"
      />
      <section v-if="details?.bulkWaste" class="rounded-[10px] border border-line bg-white p-4">
        <div class="mb-3 flex items-center gap-3">
          <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
            <span class="material-symbols-outlined text-[20px] text-purple-600" aria-hidden="true">weekend</span>
          </div>
          <h4 class="font-bold text-ink">대형폐기물</h4>
        </div>
        <div class="space-y-2 text-sm leading-6 text-muted">
          <p v-if="bulkTime"><span class="font-semibold text-ink">배출 시간:</span> {{ bulkTime }}</p>
          <p v-if="details.bulkWaste.method" class="break-words"><span class="font-semibold text-ink">배출 방법:</span> {{ details.bulkWaste.method }}</p>
          <p v-if="details.bulkWaste.place" class="break-words"><span class="font-semibold text-ink">배출 장소:</span> {{ details.bulkWaste.place }}</p>
        </div>
      </section>
    </div>

    <footer class="mt-4 rounded-[10px] bg-background-light p-3">
      <dl class="grid gap-2 text-sm sm:grid-cols-2">
        <div v-if="details?.manageDepartment" class="min-w-0">
          <dt class="font-semibold text-muted">관리부서</dt>
          <dd class="mt-1 break-words text-ink">{{ details.manageDepartment }}</dd>
        </div>
        <div v-if="details?.managePhone" class="min-w-0">
          <dt class="font-semibold text-muted">전화</dt>
          <dd class="mt-1">
            <a :href="`tel:${details.managePhone}`" class="break-all font-semibold text-primary hover:underline">
              {{ details.managePhone }}
            </a>
          </dd>
        </div>
        <div v-if="schedule.sourceUrl" class="min-w-0">
          <dt class="font-semibold text-muted">출처</dt>
          <dd class="mt-1">
            <a :href="schedule.sourceUrl" rel="noopener noreferrer" class="break-all font-semibold text-primary hover:underline">
              {{ schedule.sourceUrl }}
            </a>
          </dd>
        </div>
        <div v-if="details?.dataCreatedDate || details?.lastModified" class="min-w-0">
          <dt class="font-semibold text-muted">자료 기준일</dt>
          <dd class="mt-1 break-words text-ink">{{ details.dataCreatedDate || details.lastModified }}</dd>
        </div>
      </dl>
    </footer>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CoverageScope } from '~/types/wasteArea'
import type { WasteScheduleDetail } from '~/composables/useWasteSchedule'
import UiButton from '~/components/common/UiButton.vue'
import WasteTypeSection from '~/components/trash/WasteTypeSection.vue'
import { formatTimeRange } from '~/utils/wasteSchedule'
import { buildTrashSourceHref, storeTrashReturnStateForTarget, trashReturnStateFromRoute } from '~/utils/trashReturnContext'

const props = defineProps<{
  schedule: WasteScheduleDetail
  scope: CoverageScope
  conditionText: string
}>()

const details = computed(() => props.schedule.details)
const targetText = computed(() => props.schedule.targetRegion?.replaceAll('+', ', ') || `${props.schedule.city} ${props.schedule.district}`)
const bulkTime = computed(() => formatTimeRange(details.value?.bulkWaste?.beginTime, details.value?.bulkWaste?.endTime))
const route = useRoute()
const sourceHref = computed(() => buildTrashSourceHref(props.schedule.id))

const scopeText = computed(() => {
  if (props.scope === 'whole') return '전체 적용'
  if (props.scope === 'partial') return '일부 지역 적용'
  return '조건별 적용'
})

function openSource(event: MouseEvent) {
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  const state = trashReturnStateFromRoute(route, '동별 안내로 돌아가기', props.schedule.id)
  storeTrashReturnStateForTarget(sourceHref.value, state)
  const router = typeof useNuxtApp === 'function' ? useNuxtApp().$router : null
  if (import.meta.client && router?.push) {
    router.push({ path: sourceHref.value, state })
  } else {
    navigateTo({ path: sourceHref.value, state })
  }
}
</script>
