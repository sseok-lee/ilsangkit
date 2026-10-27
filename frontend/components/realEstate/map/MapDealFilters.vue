<template>
  <!--
    면적·가격 필터 칩. 유형·거래 메뉴(MapFilterBar)와 달리 항목이 button 이다 — 필터 값마다 갈
    페이지가 없고(지도 상태는 해시에만 담는다), 크롤 링크로 남길 이유가 없다.

    칩 줄은 좁은 화면에서 가로로 스크롤된다. 메뉴 판은 그 스크롤 상자 밖(이 루트 기준)에 두어야
    한다 — 스크롤 상자(overflow-x-auto) 안에 두면 아래로 펼쳐지는 판이 잘린다.
  -->
  <div ref="root" class="relative min-w-0 max-w-full">
    <div class="w-fit max-w-full overflow-x-auto rounded-xl border border-line bg-white/95 p-1 shadow-card-2 lg:shadow-none">
      <div class="flex w-max flex-nowrap items-center gap-1">
        <button
          v-for="chip in chips"
          :key="chip.key"
          type="button"
          :data-testid="`map-filter-${chip.key}`"
          class="min-h-[44px] flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg border px-2.5 text-xs sm:gap-1 sm:px-3.5 sm:text-sm transition-colors"
          :class="chip.value
            ? 'border-primary bg-primary-50 font-bold text-primary'
            : 'border-line bg-white text-ink hover:bg-background-light'"
          :aria-haspopup="true"
          :aria-expanded="openMenu === chip.key"
          :aria-label="`${chip.name} 필터${chip.value ? `: ${chip.value}` : ''}`"
          @click="toggle(chip.key)"
          @keydown.escape="openMenu = null"
        >
          <template v-if="chip.value">{{ chip.value }}</template>
          <template v-else>{{ chip.name }}<span class="hidden lg:inline">&nbsp;전체</span></template>
          <span
            class="material-symbols-outlined text-[14px] sm:text-[16px] transition-transform"
            :class="{ 'rotate-180': openMenu === chip.key }"
            aria-hidden="true"
          >expand_more</span>
        </button>
        <button
          v-if="active"
          type="button"
          data-testid="map-filter-reset"
          class="min-h-[44px] shrink-0 whitespace-nowrap rounded-lg px-2.5 text-xs font-medium text-muted hover:text-ink sm:text-sm"
          @click="reset"
        >
          초기화
        </button>
        <!--
          집계 단계에서는 필터가 아직 안 걸린다. 칩은 그대로 두고 언제 걸리는지만 알린다.
          데스크톱만 칩 옆에 둔다 — 모바일은 칩 줄이 가로로 넘쳐 이 글이 화면 밖으로 밀리므로
          Explorer 가 필터 줄 아래에 따로 띄운다.
        -->
        <span
          v-if="active && !applied"
          data-testid="map-filter-deferred"
          class="hidden shrink-0 whitespace-nowrap px-1.5 text-xs text-muted lg:inline"
        >단지 단계에서 적용</span>
      </div>
    </div>

    <div
      v-if="openMenu"
      :data-testid="`map-filter-menu-${openMenu}`"
      class="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-xl border border-line-2 bg-white p-1 shadow-card-2"
      role="group"
      :aria-label="openMenu === 'area' ? '전용면적' : '가격'"
    >
      <template v-for="group in menuGroups" :key="group.key">
        <p v-if="group.title" class="px-3 pb-0.5 pt-2 text-[11px] font-semibold text-muted">{{ group.title }}</p>
        <button
          v-for="opt in group.options"
          :key="`${group.key}:${opt.id ?? 'all'}`"
          type="button"
          class="min-h-[44px] flex w-full items-center whitespace-nowrap rounded-lg px-3 text-left text-sm transition-colors"
          :class="opt.selected ? 'bg-primary font-medium text-white' : 'text-ink hover:bg-background-light'"
          :aria-pressed="opt.selected"
          @click="pick(opt.next)"
        >
          {{ opt.label }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
// 테스트에서 직접 mount 하므로 vue API 를 명시 import 한다(auto-import 에 기대면 CI 에서만 깨진다).
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  AREA_OPTIONS, areaLabel, isMapFilterActive, priceLabel, priceMenuGroups,
  type MapFilterState,
} from '~/utils/mapFilters'

const props = defineProps<{
  type: string
  filter: MapFilterState
  /** 지금 화면이 단지 단계라 필터가 실제로 걸려 있는지. false 면 "단지 단계에서 적용" 안내. */
  applied: boolean
}>()
const emit = defineEmits<{ 'update:filter': [MapFilterState] }>()

type MenuKey = 'area' | 'price'
const openMenu = ref<MenuKey | null>(null)
const root = ref<HTMLElement | null>(null)

const active = computed(() => isMapFilterActive(props.filter))

const chips = computed(() => [
  { key: 'area' as const, name: '면적', value: areaLabel(props.filter.area) },
  { key: 'price' as const, name: '가격', value: priceLabel(props.type, props.filter) },
])

interface MenuOption { id: string | null; label: string; selected: boolean; next: MapFilterState }

const menuGroups = computed<Array<{ key: string; title: string | null; options: MenuOption[] }>>(() => {
  const f = props.filter
  if (openMenu.value === 'area') {
    return [{
      key: 'area',
      title: null,
      options: [
        { id: null, label: '전체', selected: f.area == null, next: { ...f, area: null } },
        ...AREA_OPTIONS.map((o) => ({ id: o.id, label: o.label, selected: f.area === o.id, next: { ...f, area: o.id } })),
      ],
    }]
  }
  const groups = priceMenuGroups(props.type)
  return [
    {
      key: 'all',
      title: null,
      options: [{ id: null, label: '전체', selected: f.price == null, next: { ...f, price: null, priceKind: null } }],
    },
    ...groups.map((g) => ({
      key: g.kind ?? 'sale',
      title: g.title,
      options: g.options.map((o) => ({
        id: o.id,
        label: o.label,
        selected: f.price === o.id && f.priceKind === g.kind,
        next: { ...f, price: o.id, priceKind: g.kind },
      })),
    })),
  ]
})

function toggle(key: MenuKey): void {
  openMenu.value = openMenu.value === key ? null : key
}

function pick(next: MapFilterState): void {
  openMenu.value = null
  emit('update:filter', next)
}

function reset(): void {
  openMenu.value = null
  emit('update:filter', { area: null, price: null, priceKind: null })
}

// 바깥을 누르면 닫는다 — 지도 위에 열린 채 남으면 핀을 가린다(MapFilterBar 와 같은 처리).
function onDocumentClick(ev: MouseEvent): void {
  if (root.value && !root.value.contains(ev.target as Node)) openMenu.value = null
}

onMounted(() => {
  if (import.meta.server) return
  document.addEventListener('click', onDocumentClick)
})

onBeforeUnmount(() => {
  if (import.meta.server) return
  document.removeEventListener('click', onDocumentClick)
})
</script>
