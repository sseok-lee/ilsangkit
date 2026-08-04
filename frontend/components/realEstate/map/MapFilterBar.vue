<template>
  <div class="flex flex-wrap gap-1.5 p-2 bg-white/95 backdrop-blur rounded-xl border border-line shadow-card">
    <!--
      button 이 아니라 a 다. 하단 유형 카드를 제거한 뒤로는 apt-rent·villa-rent·offitel-rent
      허브로 가는 내부 링크가 사이트 전체에서 여기뿐이다(GNB 드롭다운은 매매 4종만 싣는다).
      button 이면 SSR HTML 에 href 가 없어 그 3개가 내부 링크 0인 페이지가 된다.

      NuxtLink 를 쓰지 않는 이유: 클릭은 항상 preventDefault 로 가로채 클라이언트 전환하므로
      링크의 역할은 크롤러에게 href 를 보여주는 것뿐인데, NuxtLink 는 prefetch 로 6개 라우트를
      불필요하게 미리 받는다.
    -->
    <a
      v-for="opt in OPTIONS"
      :key="opt.value"
      :href="`/real-estate/${opt.value}`"
      class="px-3 py-1.5 min-h-[44px] flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
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
</script>
