<template>
  <div class="bg-white">
    <!-- 기본 정보 -->
    <div class="p-6 border-b border-gray-200">
      <div class="flex items-start justify-between mb-4">
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-2xl">{{ categoryMeta.icon }}</span>
            <h1 class="text-2xl font-bold text-gray-900">{{ facility.name }}</h1>
          </div>
          <p class="text-sm text-gray-600">{{ categoryMeta.label }}</p>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-start gap-2">
          <svg
            class="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <div>
            <p v-if="facility.roadAddress" class="text-sm text-gray-700">
              {{ facility.roadAddress }}
            </p>
            <p v-else-if="facility.address" class="text-sm text-gray-700">
              {{ facility.address }}
            </p>
          </div>
        </div>

        <div v-if="facility.city || facility.district" class="flex items-center gap-2 text-sm text-gray-500">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 21h18M3 10h18M3 7l9-4 9 4M4 10v11M20 10v11M8 14v3M12 14v3M16 14v3"
            />
          </svg>
          <span>{{ facility.city }} {{ facility.district }}</span>
        </div>
      </div>
    </div>

    <!-- 상세 정보 -->
    <div class="p-6 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">상세 정보</h2>
      <component :is="detailComponent" :details="facility.details" />
    </div>

    <!-- 지도 슬롯 -->
    <div v-if="$slots.map" class="border-b border-gray-200">
      <slot name="map" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FacilityDetail } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import ToiletDetail from './details/ToiletDetail.vue'
import WifiDetail from './details/WifiDetail.vue'
import ClothesDetail from './details/ClothesDetail.vue'
import KioskDetail from './details/KioskDetail.vue'
import ParkingDetail from './details/ParkingDetail.vue'
import AedDetail from './details/AedDetail.vue'
import LibraryDetail from './details/LibraryDetail.vue'
import HospitalDetail from './details/HospitalDetail.vue'
import PharmacyDetail from './details/PharmacyDetail.vue'

const props = defineProps<{
  facility: FacilityDetail
}>()

const categoryMeta = computed(() => CATEGORY_META[props.facility.category])

const detailComponent = computed(() => {
  switch (props.facility.category) {
    case 'toilet':
      return ToiletDetail
    case 'wifi':
      return WifiDetail
    case 'clothes':
      return ClothesDetail
    case 'kiosk':
      return KioskDetail
    case 'parking':
      return ParkingDetail
    case 'aed':
      return AedDetail
    case 'library':
      return LibraryDetail
    case 'hospital':
      return HospitalDetail
    case 'pharmacy':
      return PharmacyDetail
    default:
      return null
  }
})
</script>
