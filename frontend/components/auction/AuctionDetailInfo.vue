<!-- frontend/components/auction/AuctionDetailInfo.vue
     공매 물건 상세 정보 — 핵심 스탯 카드 + 기본정보/면적/거래조건/집행기관 섹션 -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AuctionItem } from '~/types/auction'
import { formatWonKorean, formatArea, statusLabel } from '~/types/auction'
import SectionBlock from '~/components/common/SectionBlock.vue'
import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'

const props = defineProps<{ item: AuctionItem }>()

interface Row { label: string; value: string }
const present = (v: string | null | undefined) => (v && v.trim() ? v.trim() : null)

const basicRows = computed<Row[]>(() =>
  [
    { label: '물건관리번호', value: props.item.cltrMngNo },
    { label: '물건유형', value: present(props.item.propertyType) },
    { label: '처분방식', value: present(props.item.dpslMtdNm) },
    { label: '입찰방식', value: present(props.item.bidMethod) },
    { label: '경쟁방식', value: present(props.item.competitionMethod) },
    { label: '입찰구분', value: present(props.item.bidType) },
  ].filter((r): r is Row => r.value != null),
)

const areaRows = computed<Row[]>(() => {
  const rows: Row[] = []
  if (props.item.landArea != null) rows.push({ label: '토지면적', value: formatArea(props.item.landArea) })
  if (props.item.bldArea != null) rows.push({ label: '건물면적', value: formatArea(props.item.bldArea) })
  return rows
})

const dealRows = computed<Row[]>(() =>
  [
    { label: '명도책임', value: present(props.item.evictionResp) },
    { label: '지분물건', value: props.item.isShare ? '지분물건' : '단독물건' },
    { label: '수의계약', value: props.item.pvctTrgtYn ? '가능' : '불가' },
  ].filter((r): r is Row => r.value != null),
)
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- 핵심 스탯 카드 -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
        <p class="text-caption text-faint mb-1">최저입찰가</p>
        <p class="text-base font-bold text-primary font-display tabular-nums">{{ formatWonKorean(item.minBidPrc) }}</p>
      </div>
      <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
        <p class="text-caption text-faint mb-1">입찰방식</p>
        <p class="text-base font-bold text-strong">{{ item.bidMethod ?? statusLabel(item.status) }}</p>
      </div>
      <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
        <p class="text-caption text-faint mb-1">집행기관</p>
        <p v-if="item.orgNm" class="text-base font-bold text-strong truncate">{{ item.orgNm }}</p>
        <p v-else class="text-sm font-medium text-faint">{{ EMPTY_FIELD_TEXT }}</p>
      </div>
    </div>

    <!-- 공매 기본정보 -->
    <SectionBlock heading="공매 기본정보">
      <dl class="divide-y divide-line -my-1">
        <div v-for="r in basicRows" :key="r.label" class="flex py-2.5 text-sm">
          <dt class="w-28 shrink-0 text-muted">{{ r.label }}</dt>
          <dd class="text-strong font-medium break-all">{{ r.value }}</dd>
        </div>
      </dl>
    </SectionBlock>

    <!-- 면적 정보 -->
    <SectionBlock v-if="areaRows.length" heading="면적 정보">
      <dl class="divide-y divide-line -my-1">
        <div v-for="r in areaRows" :key="r.label" class="flex py-2.5 text-sm">
          <dt class="w-28 shrink-0 text-muted">{{ r.label }}</dt>
          <dd class="text-strong font-medium">{{ r.value }}</dd>
        </div>
      </dl>
    </SectionBlock>

    <!-- 거래 조건 -->
    <SectionBlock v-if="dealRows.length" heading="거래 조건">
      <dl class="divide-y divide-line -my-1">
        <div v-for="r in dealRows" :key="r.label" class="flex py-2.5 text-sm">
          <dt class="w-28 shrink-0 text-muted">{{ r.label }}</dt>
          <dd class="text-strong font-medium">{{ r.value }}</dd>
        </div>
      </dl>
    </SectionBlock>

    <p class="text-caption text-faint leading-relaxed">
      ⚠️ 공매 물건은 공부상 면적과 실제 면적이 다를 수 있으므로 입찰 전 현장 확인을 권장합니다.
      상세 내역은 온비드(Onbid)를 통해 재확인하시기 바랍니다.
    </p>
  </div>
</template>
