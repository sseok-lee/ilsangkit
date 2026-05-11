import type { Component } from 'vue'
import type { FacilityCategory } from '~/types/facility'
import ToiletDetail from './details/ToiletDetail.vue'
import WifiDetail from './details/WifiDetail.vue'
import ClothesDetail from './details/ClothesDetail.vue'
import ParkingDetail from './details/ParkingDetail.vue'
import AedDetail from './details/AedDetail.vue'
import LibraryDetail from './details/LibraryDetail.vue'
import HospitalDetail from './details/HospitalDetail.vue'
import PharmacyDetail from './details/PharmacyDetail.vue'
import ParkDetail from './details/ParkDetail.vue'
import SchoolDetail from './details/SchoolDetail.vue'
import MarketDetail from './details/MarketDetail.vue'
import ChildcareDetail from './details/ChildcareDetail.vue'
import EvChargerDetail from './details/EvChargerDetail.vue'
import SportsDetail from './details/SportsDetail.vue'

const REGISTRY: Partial<Record<FacilityCategory, Component>> = {
  toilet: ToiletDetail,
  wifi: WifiDetail,
  clothes: ClothesDetail,
  parking: ParkingDetail,
  aed: AedDetail,
  library: LibraryDetail,
  hospital: HospitalDetail,
  pharmacy: PharmacyDetail,
  park: ParkDetail,
  school: SchoolDetail,
  market: MarketDetail,
  childcare: ChildcareDetail,
  'ev-charger': EvChargerDetail,
  sports: SportsDetail,
}

export function detailComponentFor(category: FacilityCategory): Component | null {
  return REGISTRY[category] ?? null
}

export const SUPPORTED_DETAIL_CATEGORIES = Object.keys(REGISTRY) as FacilityCategory[]
