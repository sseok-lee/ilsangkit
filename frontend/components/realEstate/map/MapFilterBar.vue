<template>
  <!--
    감싸는 흰 판을 두지 않는다 — 컨트롤이 2개뿐이라 판이 지도를 가리기만 한다. 이 div 는
    배치만 담당하고(w-fit + gap), 지도 위에서의 가독성은 각 트리거가 자기 배경과 그림자로
    책임진다. 판을 없앴으므로 트리거에 shadow 가 반드시 있어야 지도 라벨과 섞이지 않는다.
  -->
  <div ref="root" class="w-fit flex flex-nowrap gap-1.5">
    <!--
      6개 조합을 한 줄에 늘어놓는 대신 "무엇을"(아파트/빌라/오피스텔) 과 "어떻게"(매매/전월세)
      두 축으로 나눈다. 390px 에서 6칩은 4개만 보이고 가로 스크롤이 필요했는데, 2축은 두 컨트롤이
      모두 들어간다.

      메뉴 항목이 button 이 아니라 a 인 것, 그리고 v-if 가 아니라 v-show 인 것은 둘 다 의도적이다.
      전월세 허브(apt-rent·villa-rent·offitel-rent)로 가는 내부 링크가 이 컴포넌트에 몰려 있어
      button 으로 만들면 SSR HTML 에 href 가 사라진다. v-show 는 닫힌 상태에서도 DOM 에 링크를
      남긴다 — AppHeader 드롭다운이 같은 이유로 같은 선택을 하고 있다.

      다만 2축은 구조상 현재 상태와 조합된 URL 만 만들 수 있다(기본값 apt-sale 이면 villa-rent·
      offitel-rent 는 어느 메뉴에도 안 나온다). 그래서 6개 허브 링크의 정식 소유자는 푸터로
      옮겼다 — 전 페이지에 있으므로 지도 한 페이지에 의존하던 종전보다 크롤 경로가 넓어진다.
    -->
    <div v-for="menu in MENUS" :key="menu.key" class="relative shrink-0">
      <button
        type="button"
        class="min-h-[36px] sm:min-h-[44px] flex items-center gap-0.5 sm:gap-1 px-2.5 sm:px-3 rounded-lg border border-primary bg-white shadow-card text-primary text-xs sm:text-sm font-medium transition-colors hover:bg-primary-50"
        :aria-haspopup="true"
        :aria-expanded="openMenu === menu.key"
        :aria-label="`${menu.aria} 선택`"
        @click="toggle(menu.key)"
        @keydown.escape="openMenu = null"
      >
        {{ menu.currentLabel.value }}
        <span
          class="material-symbols-outlined text-[14px] sm:text-[16px] transition-transform"
          :class="{ 'rotate-180': openMenu === menu.key }"
          aria-hidden="true"
        >expand_more</span>
      </button>

      <!-- v-show(v-if 아님): 닫혀 있어도 링크가 SSR DOM 에 남아야 크롤러가 본다. -->
      <ul
        v-show="openMenu === menu.key"
        class="absolute top-full left-0 mt-1 min-w-[88px] sm:min-w-[120px] bg-white rounded-lg sm:rounded-xl shadow-lg border border-line-2 p-0.5 sm:p-1 z-50"
      >
        <li v-for="opt in menu.options" :key="opt.value">
          <a
            :href="`/real-estate/${menu.toType(opt.value)}`"
            class="min-h-[36px] sm:min-h-[44px] flex items-center px-2.5 sm:px-3 rounded-md sm:rounded-lg text-xs sm:text-sm whitespace-nowrap transition-colors"
            :class="opt.value === menu.current.value
              ? 'bg-primary text-white font-medium'
              : 'text-slate-700 hover:bg-background-light'"
            :aria-current="opt.value === menu.current.value ? 'true' : undefined"
            @click.exact.prevent="select(menu.toType(opt.value))"
          >
            {{ opt.label }}
          </a>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// 토지는 넣지 않는다. 별도 모델(면적·지목 단위)이라 지도 탐색기가 다루지 않으므로
// 여기 추가하면 클릭해도 지도가 반응할 수 없다. 토지 링크는 GNB 드롭다운이 담당한다.
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const PROPERTIES = [
  { value: 'apt', label: '아파트' },
  { value: 'villa', label: '빌라' },
  { value: 'offitel', label: '오피스텔' },
] as const

// 전세/월세로 나누지 않는다. 설계문서 4장 — summary 가 건물당 최신 1건만 보유해
// 전세로 필터하면 실제 전세 건물의 상당수가 사라진다. 구분은 목록·카드가 라벨로 한다.
const TRANSACTIONS = [
  { value: 'sale', label: '매매' },
  { value: 'rent', label: '전월세' },
] as const

const props = defineProps<{ type: string }>()
const emit = defineEmits<{ 'update:type': [string] }>()

/** 'apt-rent' → ['apt', 'rent']. 알 수 없는 값이 와도 기본 조합으로 떨어진다. */
const property = computed(() => {
  const head = props.type.split('-')[0]
  return PROPERTIES.some((p) => p.value === head) ? head : 'apt'
})
const transaction = computed(() => {
  const tail = props.type.split('-')[1]
  return TRANSACTIONS.some((t) => t.value === tail) ? tail : 'sale'
})

const labelOf = <T extends readonly { value: string; label: string }[]>(list: T, value: string) =>
  list.find((o) => o.value === value)?.label ?? list[0].label

const MENUS = [
  {
    key: 'property' as const,
    aria: '매물 유형',
    options: PROPERTIES,
    current: property,
    currentLabel: computed(() => labelOf(PROPERTIES, property.value)),
    toType: (value: string) => `${value}-${transaction.value}`,
  },
  {
    key: 'transaction' as const,
    aria: '거래 유형',
    options: TRANSACTIONS,
    current: transaction,
    currentLabel: computed(() => labelOf(TRANSACTIONS, transaction.value)),
    toType: (value: string) => `${property.value}-${value}`,
  },
]

const openMenu = ref<'property' | 'transaction' | null>(null)
const root = ref<HTMLElement | null>(null)

function toggle(key: 'property' | 'transaction') {
  openMenu.value = openMenu.value === key ? null : key
}

function select(nextType: string) {
  openMenu.value = null
  emit('update:type', nextType)
}

// 바깥을 누르면 닫는다. 지도 위에 떠 있는 컨트롤이라 메뉴가 열린 채 남으면 지도를 가린다.
function onDocumentClick(ev: MouseEvent) {
  if (!root.value) return
  if (!root.value.contains(ev.target as Node)) openMenu.value = null
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
