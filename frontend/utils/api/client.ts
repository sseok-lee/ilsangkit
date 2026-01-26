// API client utilities for ilsangkit
import type { SearchParams, SearchResponse, Facility } from '~/types'

/**
 * Fetch facilities based on search parameters
 */
export async function fetchFacilities(params: SearchParams): Promise<SearchResponse> {
  const config = useRuntimeConfig()

  const response = await $fetch<SearchResponse>('/api/facilities/search', {
    baseURL: config.public.apiBase,
    method: 'POST',
    body: params,
  })

  return response
}

/**
 * Fetch a single facility by ID
 */
export async function fetchFacilityById(id: number): Promise<Facility> {
  const config = useRuntimeConfig()

  const response = await $fetch<Facility>(`/api/facilities/${id}`, {
    baseURL: config.public.apiBase,
  })

  return response
}
