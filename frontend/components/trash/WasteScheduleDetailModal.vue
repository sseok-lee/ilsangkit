<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/55 sm:p-4"
        data-testid="trash-detail-backdrop"
        @click.self="emit('close')"
      >
        <section
          ref="dialogRef"
          role="dialog"
          aria-modal="true"
          aria-labelledby="trash-detail-title"
          tabindex="-1"
          class="w-full max-h-[92dvh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl outline-none sm:max-w-3xl sm:rounded-2xl"
        >
          <header class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6 sm:py-5">
            <div class="min-w-0">
              <p v-if="schedule" class="text-xs font-semibold text-slate-500">
                {{ shortCity }} · {{ schedule.district }}
              </p>
              <h2 id="trash-detail-title" class="mt-1 text-xl font-extrabold tracking-tight text-slate-950 sm:text-2xl">
                {{ schedule ? `${displayTargetRegion} 쓰레기 배출 일정` : '쓰레기 배출 일정' }}
              </h2>
              <p v-if="schedule" class="mt-1 text-sm text-slate-500">
                {{ [schedule.emissionPlace, schedule.details?.emissionPlaceType].filter(Boolean).join(' · ') || '배출 장소 정보 없음' }}
              </p>
            </div>
            <button
              type="button"
              data-testid="trash-detail-close"
              class="flex size-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="상세 정보 닫기"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined">close</span>
            </button>
          </header>

          <div class="px-5 py-5 sm:px-6 sm:py-6">
            <div v-if="loading" class="flex min-h-64 flex-col items-center justify-center" role="status" aria-live="polite">
              <div class="size-9 animate-spin rounded-full border-2 border-primary/20 border-b-primary" />
              <p class="mt-3 text-sm text-slate-500">상세 일정을 불러오는 중...</p>
            </div>

            <div v-else-if="error || !schedule" class="flex min-h-64 flex-col items-center justify-center text-center" role="alert">
              <span class="material-symbols-outlined text-4xl text-slate-400">error</span>
              <p class="mt-3 font-semibold text-slate-800">상세 일정을 불러오지 못했습니다</p>
              <p class="mt-1 text-sm text-slate-500">잠시 후 다시 시도해주세요.</p>
            </div>

            <template v-else>
              <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <article
                  v-for="item in wasteSections"
                  :key="item.label"
                  class="rounded-2xl border border-slate-200 p-4"
                >
                  <div class="flex items-center gap-2">
                    <span :class="['flex size-8 items-center justify-center rounded-full', item.iconClass]">
                      <span class="material-symbols-outlined text-[18px]">{{ item.icon }}</span>
                    </span>
                    <span :class="['rounded-full px-2.5 py-1 text-xs font-bold', item.badgeClass]">
                      {{ item.label }}
                    </span>
                  </div>
                  <p v-if="item.primary" :class="['mt-3 text-lg font-extrabold', item.textClass]">
                    {{ item.primary }}
                  </p>
                  <p v-if="item.time" class="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
                    <span class="material-symbols-outlined text-[17px] text-slate-400">schedule</span>
                    {{ item.time }}
                  </p>
                  <div v-if="item.method" class="mt-3 border-t border-slate-100 pt-3">
                    <p class="text-[11px] font-semibold text-slate-400">배출 방법</p>
                    <p class="mt-1 text-sm leading-relaxed text-slate-700">{{ item.method }}</p>
                  </div>
                </article>
              </div>

              <div
                v-if="schedule.details?.uncollectedDay"
                class="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm"
              >
                <span class="material-symbols-outlined text-[19px] text-red-500">warning</span>
                <span class="font-bold text-red-600">미수거일</span>
                <span class="text-red-700">{{ formatDays(schedule.details.uncollectedDay) }}</span>
              </div>

              <div
                v-if="schedule.details?.manageDepartment || schedule.details?.managePhone"
                class="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 px-4 py-3 sm:grid-cols-2"
              >
                <div v-if="schedule.details?.manageDepartment" class="flex items-center gap-3">
                  <span class="flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <span class="material-symbols-outlined text-[19px]">support_agent</span>
                  </span>
                  <div>
                    <p class="text-[11px] font-semibold text-slate-400">담당부서</p>
                    <p class="font-bold text-slate-800">{{ schedule.details.manageDepartment }}</p>
                  </div>
                </div>
                <a
                  v-if="schedule.details?.managePhone"
                  :href="`tel:${schedule.details.managePhone}`"
                  class="flex items-center gap-3 rounded-lg transition-colors hover:bg-slate-50"
                >
                  <span class="flex size-9 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                    <span class="material-symbols-outlined text-[19px]">call</span>
                  </span>
                  <div>
                    <p class="text-[11px] font-semibold text-slate-400">전화번호</p>
                    <p class="font-bold text-blue-600">{{ schedule.details.managePhone }}</p>
                  </div>
                </a>
              </div>

              <div class="mt-5 flex gap-3">
                <button
                  type="button"
                  class="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                  @click="emit('close')"
                >
                  닫기
                </button>
                <a
                  v-if="schedule.details?.managePhone"
                  :href="`tel:${schedule.details.managePhone}`"
                  class="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark"
                >
                  <span class="material-symbols-outlined text-[18px]">call</span>
                  전화 문의
                </a>
              </div>
            </template>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { BulkWasteInfo, WasteScheduleDetail, WasteTypeInfo } from '~/composables/useWasteSchedule'

const props = defineProps<{
  open: boolean
  schedule: WasteScheduleDetail | null
  loading: boolean
  error?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

interface WasteSection {
  label: string
  icon: string
  iconClass: string
  badgeClass: string
  textClass: string
  primary: string
  time: string
  method: string
}

const dialogRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''
let previousActiveElement: HTMLElement | null = null

const shortCity = computed(() =>
  props.schedule?.city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '') || ''
)
const displayTargetRegion = computed(() => props.schedule?.targetRegion?.replaceAll('+', ', ') || '지역')

function formatDays(value?: string): string {
  if (!value) return ''
  return value.split(/[+,\s]+/).filter(Boolean).join(' · ')
}

function formatTimeRange(beginTime?: string, endTime?: string): string {
  if (!beginTime && !endTime) return ''
  if (!beginTime) return endTime || ''
  if (!endTime) return beginTime
  const nextDay = endTime < beginTime ? '익일 ' : ''
  return `${beginTime} ~ ${nextDay}${endTime}`
}

function createWasteSection(
  label: string,
  info: WasteTypeInfo | BulkWasteInfo | undefined,
  style: Pick<WasteSection, 'icon' | 'iconClass' | 'badgeClass' | 'textClass'>,
  isBulk = false,
): WasteSection | null {
  if (!info) return null
  const primary = isBulk
    ? (info as BulkWasteInfo).place || '지정 장소'
    : formatDays((info as WasteTypeInfo).dayOfWeek) || '요일 정보 없음'

  return {
    label,
    ...style,
    primary,
    time: formatTimeRange(info.beginTime, info.endTime),
    method: info.method || '',
  }
}

const wasteSections = computed<WasteSection[]>(() => {
  const details = props.schedule?.details
  if (!details) return []

  return [
    createWasteSection('일반쓰레기', details.livingWaste, {
      icon: 'delete', iconClass: 'bg-amber-50 text-amber-600', badgeClass: 'bg-amber-100 text-amber-700', textClass: 'text-amber-600',
    }),
    createWasteSection('음식물쓰레기', details.foodWaste, {
      icon: 'restaurant', iconClass: 'bg-emerald-50 text-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700', textClass: 'text-emerald-600',
    }),
    createWasteSection('재활용', details.recyclable, {
      icon: 'recycling', iconClass: 'bg-teal-50 text-teal-600', badgeClass: 'bg-teal-100 text-teal-700', textClass: 'text-teal-600',
    }),
    createWasteSection('대형폐기물', details.bulkWaste, {
      icon: 'weekend', iconClass: 'bg-purple-50 text-purple-600', badgeClass: 'bg-purple-100 text-purple-700', textClass: 'text-purple-600',
    }, true),
  ].filter((item): item is WasteSection => item !== null)
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open) emit('close')
}

watch(() => props.open, async (open) => {
  if (typeof document === 'undefined') return
  if (open) {
    previousBodyOverflow = document.body.style.overflow
    previousActiveElement = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'
    await nextTick()
    dialogRef.value?.focus()
  } else {
    document.body.style.overflow = previousBodyOverflow
    previousActiveElement?.focus()
  }
}, { immediate: true })

if (typeof window !== 'undefined') window.addEventListener('keydown', handleKeydown)

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') window.removeEventListener('keydown', handleKeydown)
  if (typeof document !== 'undefined') document.body.style.overflow = previousBodyOverflow
})
</script>
