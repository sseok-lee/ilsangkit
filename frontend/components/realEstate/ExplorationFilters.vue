<template>
  <div class="exploration-filters">
    <fieldset>
      <legend>건물 유형</legend>
      <div class="filter-links" aria-label="건물 유형">
        <NuxtLink
          v-for="option in propertyOptions"
          :key="option.value"
          :to="typeHref(option.value, transactionMode)"
          class="filter-link"
          :class="{ active: option.value === propertyType }"
          :aria-current="option.value === propertyType ? 'page' : undefined"
        >
          {{ option.label }}
        </NuxtLink>
      </div>
    </fieldset>

    <fieldset>
      <legend>거래 유형</legend>
      <div class="filter-links" aria-label="거래 유형">
        <NuxtLink
          v-for="option in transactionOptions"
          :key="option.value"
          :to="typeHref(propertyType, option.value)"
          class="filter-link"
          :class="{ active: option.value === transactionMode }"
          :aria-current="option.value === transactionMode ? 'page' : undefined"
        >
          {{ option.label }}
        </NuxtLink>
      </div>
    </fieldset>

    <div class="region-filter">
      <RegionCascadingDropdown
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

<style scoped>
.exploration-filters {
  display: grid;
  grid-template-columns: auto auto minmax(18rem, 1fr);
  gap: 1.25rem;
  align-items: end;
}

fieldset {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin-bottom: 0.5rem;
  color: #56627a;
  font-size: 0.75rem;
  font-weight: 700;
}

.filter-links {
  display: flex;
  min-height: 44px;
  gap: 0.25rem;
  padding: 0.25rem;
  border-radius: 0.625rem;
  background: #f7f8fa;
}

.filter-link {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.875rem;
  border-radius: 0.5rem;
  color: #56627a;
  font-size: 0.875rem;
  font-weight: 700;
  text-decoration: none;
}

.filter-link.active {
  background: #15213b;
  color: #fff;
}

.filter-link:focus-visible {
  outline: 2px solid #2450dc;
  outline-offset: 2px;
}

.region-filter {
  min-width: 0;
}

@media (max-width: 900px) {
  .exploration-filters {
    grid-template-columns: 1fr 1fr;
  }

  .region-filter {
    grid-column: 1 / -1;
  }
}

@media (max-width: 520px) {
  .exploration-filters {
    grid-template-columns: minmax(0, 1fr);
    gap: 1rem;
  }

  .region-filter {
    grid-column: auto;
  }

  .filter-links {
    width: 100%;
  }

  .filter-link {
    flex: 1 1 0;
    padding-inline: 0.5rem;
  }
}
</style>
