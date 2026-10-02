<template>
  <HardLink :to="linkUrl" class="exploration-building-row">
    <div data-testid="building-cell" class="building-cell">
      <h3>{{ building.buildingName }}</h3>
      <p>{{ addressText }}</p>
    </div>

    <div class="deal-cell">
      <template v-if="building.latestDeals">
        <DealSnapshot
          v-if="mode === 'sale'"
          :deal="building.latestDeals.sale"
          kind="sale"
        />
        <template v-else-if="mode === 'rent'">
          <DealSnapshot :deal="building.latestDeals.jeonse" kind="jeonse" />
          <DealSnapshot :deal="building.latestDeals.wolse" kind="wolse" />
        </template>
        <DealSnapshot
          v-else-if="representative"
          :deal="representative"
          :kind="representative.kind"
        />
        <p v-else class="row-empty">거래 없음</p>
      </template>
      <p v-else role="status" class="row-empty">거래 정보를 불러오지 못했습니다</p>
    </div>
  </HardLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DealSnapshot from '~/components/realEstate/DealSnapshot.vue'
import HardLink from '~/components/common/HardLink.vue'
import type { ComplexInfo, RealEstatePropertyType, RealEstateType } from '~/types/realEstate'
import type { DealKind } from '~/types/realEstateExploration'
import { selectRepresentativeDeal } from '~/utils/realEstateLatestDeals'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'

interface Props {
  building: ComplexInfo
  mode: 'sale' | 'rent' | 'representative'
  realEstateType?: RealEstateUrlType
}

const props = defineProps<Props>()

const representative = computed(() => {
  if (!props.building.latestDeals) return null
  return selectRepresentativeDeal(props.building.latestDeals)
})

const addressText = computed(() =>
  [props.building.city, props.building.district, props.building.dongName, props.building.jibun]
    .filter(Boolean)
    .join(' ')
)

function propertyTypeFromType(type: RealEstateType | undefined): RealEstatePropertyType {
  if (type?.startsWith('villa-')) return 'villa'
  if (type?.startsWith('offitel-')) return 'offitel'
  return 'apt'
}

function typeForDeal(kind: DealKind | null): RealEstateUrlType {
  const sourceType = props.realEstateType ?? props.building.type
  if (!kind && sourceType) return sourceType as RealEstateUrlType

  const propertyType = propertyTypeFromType(sourceType)
  if (kind === 'sale') return `${propertyType}-sale` as RealEstateUrlType
  if (kind === 'jeonse' || kind === 'wolse') return `${propertyType}-rent` as RealEstateUrlType
  if (props.mode === 'sale') return `${propertyType}-sale` as RealEstateUrlType
  if (props.mode === 'rent') return `${propertyType}-rent` as RealEstateUrlType
  return (sourceType ?? `${propertyType}-sale`) as RealEstateUrlType
}

const selectedKind = computed<DealKind | null>(() => {
  if (!props.building.latestDeals) return null
  if (props.mode === 'sale' && props.building.latestDeals.sale) return 'sale'
  if (props.mode === 'rent') {
    if (props.building.latestDeals.jeonse) return 'jeonse'
    if (props.building.latestDeals.wolse) return 'wolse'
    return null
  }
  return representative.value?.kind ?? null
})

const linkUrl = computed(() => {
  const kind = selectedKind.value
  const base = toRealEstateUrl({
    type: typeForDeal(kind),
    city: props.building.city,
    district: props.building.district,
    buildingName: props.building.buildingName,
    buildingKey: props.building.buildingKey,
    canonicalPath: props.building.canonicalPath,
  })
  if (kind === 'jeonse' || kind === 'wolse') return `${base}?mode=${kind}`
  return base
})
</script>

<style scoped>
.exploration-building-row {
  display: grid;
  grid-template-columns: minmax(14rem, 1.2fr) minmax(28rem, 2fr);
  gap: 1.5rem;
  align-items: center;
  padding: 1.5rem 1.25rem;
  border-bottom: 1px solid rgb(var(--border-rgb));
  background: rgb(var(--surface-rgb));
  color: rgb(var(--ink-rgb));
  text-decoration: none;
  min-width: 0;
}

.building-cell,
.deal-cell {
  min-width: 0;
}

.building-cell h3 {
  margin: 0;
  color: rgb(var(--ink-rgb));
  font-size: 1rem;
  font-weight: 800;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.building-cell p {
  margin: 0.375rem 0 0;
  color: rgb(var(--muted-rgb));
  font-size: 0.8125rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.deal-cell {
  display: grid;
  gap: 0.875rem;
}

.row-empty {
  margin: 0;
  color: rgb(var(--muted-rgb));
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .exploration-building-row {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.75rem;
    padding: 1.25rem 0;
  }
}
</style>
