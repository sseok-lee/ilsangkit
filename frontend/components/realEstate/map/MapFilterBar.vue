<template>
  <div
    class="flex flex-nowrap overflow-x-auto gap-1 p-1 sm:gap-1.5 sm:p-2 bg-white/95 backdrop-blur rounded-lg sm:rounded-xl border border-line shadow-card"
  >
    <!--
      button 이 아니라 a 다. 하단 유형 카드를 제거한 뒤로는 apt-rent·villa-rent·offitel-rent
      허브로 가는 내부 링크가 사이트 전체에서 여기뿐이다(GNB 드롭다운은 매매 4종만 싣는다).
      button 이면 SSR HTML 에 href 가 없어 그 3개가 내부 링크 0인 페이지가 된다.

      NuxtLink 를 쓰지 않는 이유: 클릭은 항상 preventDefault 로 가로채 클라이언트 전환하므로
      링크의 역할은 크롤러에게 href 를 보여주는 것뿐인데, NuxtLink 는 prefetch 로 6개 라우트를
      불필요하게 미리 받는다.

      모바일에서 6개 라벨이 두 줄로 감싸져 지도 상단 112px 를 덮던 문제 — flex-wrap 을
      flex-nowrap + overflow-x-auto 로 바꿔 한 줄 가로 스크롤로 만든다. shrink-0 없으면
      flex 가 라벨을 스크롤 대신 압축해버린다. 데스크톱은 원래도 6개가 한 줄에 들어가서
      overflow 가 생기지 않으므로 시각적으로 그대로다.

      모바일 치수는 sm 미만에서만 줄인다(패딩·간격·글자·모서리). 높이를 정하는
      min-h-[44px] 는 반응형으로 두지 않는다 — 터치 타깃 최소치라 프로젝트 10개
      컴포넌트가 공유하는 관례이고 이 컴포넌트 테스트가 직접 고정한다. 바를 더 낮추려면
      그 결정을 먼저 뒤집어야 한다.
    -->
    <a
      v-for="opt in OPTIONS"
      :key="opt.value"
      :ref="(el) => setItemRef(opt.value, el)"
      :href="`/real-estate/${opt.value}`"
      class="shrink-0 px-2.5 sm:px-3 py-1 sm:py-1.5 min-h-[44px] flex items-center justify-center rounded-md sm:rounded-lg text-xs sm:text-sm font-medium transition-colors"
      :class="opt.value === props.type
        ? 'bg-primary text-white'
        : 'bg-background-light text-slate-700 hover:bg-slate-200'"
      :aria-current="opt.value === props.type ? 'true' : undefined"
      @click.exact.prevent="emit('update:type', opt.value)"
    >
      {{ opt.label }}
    </a>
  </div>
</template>

<script setup lang="ts">
// 거래 축은 매매/전월세 2종이다. 전세/월세로 나누지 않는 이유는 설계문서 4장 참조 —
// summary 가 건물당 최신 1건만 보유해 전세 필터 시 아파트 44.6%·오피스텔 56.4%가 누락된다.
//
// 토지는 넣지 않는다. 별도 모델(면적·지목 단위)이라 지도 탐색기가 다루지 않으므로
// 여기 추가하면 클릭해도 지도가 반응할 수 없다. 토지 링크는 GNB 드롭다운이 담당한다.
import { nextTick, onMounted, watch, type ComponentPublicInstance } from 'vue'

const OPTIONS = [
  { value: 'apt-sale', label: '아파트 매매' },
  { value: 'apt-rent', label: '아파트 전월세' },
  { value: 'villa-sale', label: '빌라 매매' },
  { value: 'villa-rent', label: '빌라 전월세' },
  { value: 'offitel-sale', label: '오피스텔 매매' },
  { value: 'offitel-rent', label: '오피스텔 전월세' },
] as const

const props = defineProps<{ type: string }>()
const emit = defineEmits<{ 'update:type': [string] }>()

const itemRefs = new Map<string, HTMLElement>()

function setItemRef(value: string, el: Element | ComponentPublicInstance | null) {
  if (el instanceof HTMLElement) {
    itemRefs.set(value, el)
  } else {
    itemRefs.delete(value)
  }
}

// 공유 링크는 '오피스텔 전월세'처럼 목록 맨 끝에 있는 항목이 선택된 채로 도착할 수 있다.
// 가로 스크롤 바가 되면서 그 항목이 화면 밖에 있으면 아무것도 선택 안 된 바처럼 보인다 —
// 선택된 항목을 항상 보이는 곳으로 스크롤해준다. SSR 에는 스크롤 대상 DOM 이 없어 가드한다.
function scrollActiveIntoView() {
  if (import.meta.server) return
  const el = itemRefs.get(props.type)
  if (!el) return
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

onMounted(() => {
  scrollActiveIntoView()
})

watch(() => props.type, async () => {
  await nextTick()
  scrollActiveIntoView()
})
</script>
