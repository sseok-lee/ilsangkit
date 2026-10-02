<template>
  <div class="exploration-filters grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-[auto_auto_minmax(18rem,1fr)] lg:items-end">
    <fieldset class="min-w-0">
      <legend class="mb-2 text-[13px] font-semibold text-muted">건물 유형</legend>
      <SegmentedControl :items="propertyItems" :model-value="propertyType" aria-label="건물 유형" fill />
    </fieldset>
    <fieldset class="min-w-0">
      <legend class="mb-2 text-[13px] font-semibold text-muted">거래 유형</legend>
      <SegmentedControl :items="transactionItems" :model-value="transactionMode" aria-label="거래 유형" fill />
    </fieldset>
    <div class="min-w-0 sm:col-span-2 lg:col-span-1">
      <RegionCascadingDropdown
        variant="flat"
        :city="city ?? ''"
        :district="district ?? ''"
        @update:city="changeCity"
        @update:district="changeDistrict"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'
import SegmentedControl from '~/components/common/SegmentedControl.vue'
import { explorationListHref } from '~/utils/explorationNavigation'
import type { RealEstateUrlType } from '~/utils/realEstateUrl'

type PropertyType = 'apt' | 'villa' | 'offitel'
type TransactionMode = 'sale' | 'rent'

const props = defineProps<{
  type: RealEstateUrlType
  city?: string
  district?: string
}>()

const propertyOptions: { value: PropertyType; label: string }[] = [
  { value: 'apt', label: '아파트' },
  { value: 'villa', label: '빌라' },
  { value: 'offitel', label: '오피스텔' },
]

const transactionOptions: { value: TransactionMode; label: string }[] = [
  { value: 'sale', label: '매매' },
  { value: 'rent', label: '전월세' },
]

const propertyType = computed(() => props.type.split('-')[0] as PropertyType)
const transactionMode = computed(() => props.type.split('-')[1] as TransactionMode)

function selectedRegion(): { city: string; district?: string } | null {
  if (!props.city) return null
  return { city: props.city, district: props.district || undefined }
}

function typeHref(property: PropertyType, mode: TransactionMode): string {
  return explorationListHref(`${property}-${mode}` as RealEstateUrlType, selectedRegion())
}

const propertyItems = computed(() => propertyOptions.map((option) => ({
  value: option.value,
  label: option.label,
  to: typeHref(option.value, transactionMode.value),
})))

const transactionItems = computed(() => transactionOptions.map((option) => ({
  value: option.value,
  label: option.label,
  to: typeHref(propertyType.value, option.value),
})))

async function changeCity(city: string): Promise<void> {
  await navigateTo(explorationListHref(props.type, city ? { city } : null))
}

async function changeDistrict(district: string): Promise<void> {
  if (!props.city) return
  await navigateTo(explorationListHref(props.type, {
    city: props.city,
    district: district || undefined,
  }))
}
</script>

