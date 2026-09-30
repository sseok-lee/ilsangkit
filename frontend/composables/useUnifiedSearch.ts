import { getCurrentScope, onScopeDispose, readonly, ref, type Ref } from 'vue'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useRealEstate } from '~/composables/useRealEstate'
import type { GroupedSearchResponse } from '~/types/facility'
import type {
  ComplexListResponse,
  RealEstateGroupedResponse,
  RealEstatePropertyType,
} from '~/types/realEstate'
import type { SearchDomainState } from '~/types/unifiedSearch'

type RetryDomain = 'buildings' | 'facilities' | 'property'
type PropertyRequest = { q: string; property: RealEstatePropertyType; page: number }

function idleState<T>(): SearchDomainState<T> {
  return { status: 'idle', data: null, error: null, keyword: '' }
}

export function useUnifiedSearch() {
  const { searchAll, searchPropertyComplexesByKeyword } = useRealEstate()
  const { requestGrouped } = useFacilitySearch()

  const buildings: Ref<SearchDomainState<RealEstateGroupedResponse>> = ref(idleState())
  const facilities: Ref<SearchDomainState<GroupedSearchResponse>> = ref(idleState())
  const propertyResults: Ref<SearchDomainState<ComplexListResponse>> = ref(idleState())

  let buildingSeq = 0
  let facilitySeq = 0
  let propertySeq = 0
  let lastBuildingKeyword = ''
  let lastFacilityKeyword = ''
  let lastPropertyRequest: PropertyRequest | null = null

  function invalidateAll() {
    buildingSeq++
    facilitySeq++
    propertySeq++
  }

  async function loadBuildings(q: string): Promise<void> {
    lastBuildingKeyword = q
    const token = ++buildingSeq
    buildings.value = { status: 'pending', data: null, error: null, keyword: q }

    try {
      const data = await searchAll(q)
      if (token !== buildingSeq) return
      buildings.value = { status: 'success', data, error: null, keyword: q }
    } catch {
      if (token !== buildingSeq) return
      buildings.value = {
        status: 'error',
        data: null,
        error: '부동산을 불러오지 못했습니다',
        keyword: q,
      }
    }
  }

  async function loadFacilities(q: string): Promise<void> {
    lastFacilityKeyword = q
    const token = ++facilitySeq
    facilities.value = { status: 'pending', data: null, error: null, keyword: q }

    try {
      const data = await requestGrouped({ keyword: q, limit: 3 })
      if (token !== facilitySeq) return
      facilities.value = { status: 'success', data, error: null, keyword: q }
    } catch {
      if (token !== facilitySeq) return
      facilities.value = {
        status: 'error',
        data: null,
        error: '생활시설을 불러오지 못했습니다',
        keyword: q,
      }
    }
  }

  async function search(rawQuery: string): Promise<void> {
    const q = rawQuery.trim()
    if (!q) {
      clear()
      return
    }

    invalidateAll()
    propertyResults.value = idleState()
    lastPropertyRequest = null
    await Promise.all([loadBuildings(q), loadFacilities(q)])
  }

  async function loadProperty(
    rawQuery: string,
    property: RealEstatePropertyType,
    page: number
  ): Promise<void> {
    const q = rawQuery.trim()
    if (!q) {
      propertySeq++
      propertyResults.value = idleState()
      lastPropertyRequest = null
      return
    }

    const request = { q, property, page }
    lastPropertyRequest = request
    const token = ++propertySeq
    propertyResults.value = { status: 'pending', data: null, error: null, keyword: q }

    try {
      const data = await searchPropertyComplexesByKeyword(property, q, page, 20)
      if (token !== propertySeq) return
      propertyResults.value = { status: 'success', data, error: null, keyword: q }
    } catch {
      if (token !== propertySeq) return
      propertyResults.value = {
        status: 'error',
        data: null,
        error: '부동산 목록을 불러오지 못했습니다',
        keyword: q,
      }
    }
  }

  async function retry(domain: RetryDomain): Promise<void> {
    if (domain === 'buildings' && lastBuildingKeyword) {
      await loadBuildings(lastBuildingKeyword)
      return
    }
    if (domain === 'facilities' && lastFacilityKeyword) {
      await loadFacilities(lastFacilityKeyword)
      return
    }
    if (domain === 'property' && lastPropertyRequest) {
      const { q, property, page } = lastPropertyRequest
      await loadProperty(q, property, page)
    }
  }

  function clear() {
    invalidateAll()
    buildings.value = idleState()
    facilities.value = idleState()
    propertyResults.value = idleState()
    lastBuildingKeyword = ''
    lastFacilityKeyword = ''
    lastPropertyRequest = null
  }

  if (getCurrentScope()) {
    onScopeDispose(invalidateAll)
  }

  return {
    buildings: readonly(buildings),
    facilities: readonly(facilities),
    propertyResults: readonly(propertyResults),
    search,
    loadProperty,
    retry,
    clear,
  }
}
