<template>
  <div class="flex flex-col gap-3">
    <PublicRentalDetailHeader :rental="rental" />

    <PublicRentalPriceCard :rental="rental" />

    <PublicRentalSpecGrid :rental="rental" />

    <PublicRentalSiblings :siblings="siblings" />

    <!-- Ad: 기본정보/형제단지 이후 (청약 패턴 1번) -->
    <AdBanner />

    <SectionBlock heading="위치" :subtext="locationSubtext">
      <div v-if="hasCoords" class="rounded-xl border border-line overflow-hidden h-[300px] md:h-[360px]">
        <ClientOnly>
          <FacilityMap
            :center="{ lat: rental.lat as number, lng: rental.lng as number }"
            :facilities="markerFacility"
            :level="3"
          />
        </ClientOnly>
      </div>
      <div v-else class="rounded-xl bg-slate-50 p-8 text-center">
        <p class="text-slate-500 text-sm">이 단지는 좌표 정보가 등록되지 않아 지도를 표시할 수 없습니다.</p>
        <p class="mt-1 text-slate-400 text-xs">{{ rental.complexName }}</p>
      </div>
    </SectionBlock>

    <SectionBlock heading="주변 생활시설" subtext="단지 반경 1km 이내의 학교·병원·약국·공원 등을 확인하세요.">
      <NearbyFacilities v-if="hasCoords" :lat="rental.lat as number" :lng="rental.lng as number" />
      <div v-else class="rounded-xl bg-slate-50 p-6 text-center text-slate-500 text-sm">
        좌표 정보가 등록되어 있지 않아 주변 생활시설을 표시할 수 없습니다. 단지 주소를 참고하여 직접 확인해 주세요.
      </div>
    </SectionBlock>

    <!-- Ad: 위치/주변 시설 이후 (청약 패턴 2번) -->
    <AdBanner />

    <PublicRentalRentalTypeGuide :rental-type="rental.rentalType" />

    <PublicRentalEligibility />

    <PublicRentalApplyGuide />

    <PublicRentalFAQ />

    <PublicRentalNearbyComplexes
      :complexes="nearby"
      :city="rental.city"
      :district="rental.district"
    />

    <!-- Ad: 본문 마무리 (청약 패턴 3번) -->
    <AdBanner />

    <DataSourceSection domain="public-rental" :last-sync-date="lastSyncDate" />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent } from 'vue'
import type { PublicRentalComplex } from '~/types/publicRental'
import type { FacilitySearchItem } from '~/types'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import NearbyFacilities from '~/components/realEstate/NearbyFacilities.vue'
import PublicRentalDetailHeader from '~/components/subscription/PublicRentalDetailHeader.vue'
import PublicRentalPriceCard from '~/components/subscription/PublicRentalPriceCard.vue'
import PublicRentalSpecGrid from '~/components/subscription/PublicRentalSpecGrid.vue'
import PublicRentalSiblings from '~/components/subscription/PublicRentalSiblings.vue'
import PublicRentalRentalTypeGuide from '~/components/subscription/PublicRentalRentalTypeGuide.vue'
import PublicRentalEligibility from '~/components/subscription/PublicRentalEligibility.vue'
import PublicRentalApplyGuide from '~/components/subscription/PublicRentalApplyGuide.vue'
import PublicRentalFAQ from '~/components/subscription/PublicRentalFAQ.vue'
import PublicRentalNearbyComplexes from '~/components/subscription/PublicRentalNearbyComplexes.vue'
const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const props = defineProps<{
  rental: PublicRentalComplex
  siblings: PublicRentalComplex[]
  nearby: PublicRentalComplex[]
  lastSyncDate?: string | null
}>()

const hasCoords = computed(
  () =>
    props.rental.lat !== null &&
    props.rental.lat !== undefined &&
    props.rental.lng !== null &&
    props.rental.lng !== undefined,
)

const locationSubtext = computed(() => `${props.rental.city} ${props.rental.district} · ${props.rental.complexName}`)

const markerFacility = computed<FacilitySearchItem[]>(() => {
  if (!hasCoords.value) return []
  return [
    {
      id: `public-rental-${props.rental.id}`,
      name: props.rental.complexNameKor || props.rental.complexName,
      // 지도 마커 타입(FacilityCategory) 충족용 placeholder — 실제 시설 아님(상세 페이지의 단일 위치 핀)
      category: 'toilet' as const,
      address: props.rental.complexName,
      roadAddress: null,
      lat: props.rental.lat as number,
      lng: props.rental.lng as number,
      city: props.rental.city,
      district: props.rental.district,
    },
  ]
})
</script>
